import { readFile } from 'fs/promises';
import { load, loadAll } from 'js-yaml';
import { join, resolve, dirname } from 'path';
import { EventBus } from './core/eventbus';
import { RuntimeManager } from './core/runtime-manager';
import { InMemoryNetworkStateStore } from './core/network/store';
import { glob } from 'glob';
import type { RuntimeResource } from './types';

/**
 * 简化的资源加载器
 * 提供更简单的API来加载和管理Kubernetes风格的资源
 */
export class SimpleResourceManager {
  /**
   * 运行时管理器
   */
  public runtimeManager: RuntimeManager;
  
  /**
   * 事件总线
   */
  private eventBus: EventBus;
  
  /**
   * 资源缓存
   */
  private resources: Map<string, RuntimeResource> = new Map();
  
  /**
   * 创建一个简化的资源管理器
   */
  constructor() {
    this.eventBus = new EventBus();
    // 使用正确的参数创建 RuntimeManager
    const networkStore = new InMemoryNetworkStateStore();
    this.runtimeManager = new RuntimeManager(networkStore);
    
    // 监听资源添加事件
    this.runtimeManager.on('resource:added', (resource: RuntimeResource) => {
      this.resources.set(this.getResourceKey(resource), resource);
    });
  }
  
  /**
   * 从文件加载资源
   * @param filePath 文件路径
   * @returns 加载的资源
   */
  async loadFile(filePath: string): Promise<RuntimeResource[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseYAML(content);
    } catch (error) {
      throw new Error(`加载文件失败 ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * 加载多个文件
   * @param pattern glob 模式
   * @returns 加载的所有资源
   */
  async loadFiles(pattern: string): Promise<RuntimeResource[]> {
    const files = await glob(pattern);
    const allResources: RuntimeResource[] = [];
    
    for (const file of files) {
      const resources = await this.loadFile(file);
      allResources.push(...resources);
    }
    
    return allResources;
  }
  
  /**
   * 解析YAML内容
   * @param content YAML内容
   * @returns 解析的资源
   */
  parseYAML(content: string): RuntimeResource[] {
    try {
      // 尝试解析为单个文档
      const doc = load(content) as any;
      
      // 如果是MastraPod，解析其资源
      if (doc && doc.kind === 'MastraPod' && Array.isArray(doc.resources)) {
        // 验证资源元数据
        return doc.resources.map((resource: RuntimeResource) => this._validateAndFixResourceMetadata(resource));
      }
      
      // 尝试解析为多文档
      const docs = loadAll(content) as any[];
      return docs.filter(Boolean).map((resource: RuntimeResource) => 
        this._validateAndFixResourceMetadata(resource)
      );
    } catch (error) {
      throw new Error(`解析YAML失败: ${error.message}`);
    }
  }
  
  /**
   * 验证并修复资源元数据
   * @param resource 资源对象
   * @private
   */
  private _validateAndFixResourceMetadata(resource: RuntimeResource): RuntimeResource {
    if (!resource) return resource;
    
    // 确保元数据对象存在
    if (!resource.metadata || typeof resource.metadata !== 'object') {
      resource.metadata = {
        name: `auto-${resource.kind?.toLowerCase() || 'unknown'}-${Date.now()}`,
        namespace: 'default'
      };
      return resource;
    }
    
    // 确保名称存在
    if (!resource.metadata.name) {
      resource.metadata.name = `auto-${resource.kind?.toLowerCase() || 'unknown'}-${Date.now()}`;
    }
    
    // 确保命名空间存在
    if (!resource.metadata.namespace) {
      resource.metadata.namespace = 'default';
    }
    
    return resource;
  }
  
  /**
   * 注册资源到运行时管理器
   * @param resource 资源对象
   */
  async registerResource(resource: RuntimeResource): Promise<void> {
    try {
      await this.runtimeManager.addResource(resource);
      // 不需要手动添加到缓存，事件监听器会处理
    } catch (error) {
      throw new Error(`注册资源失败 ${resource.kind}/${resource.metadata.name}: ${error.message}`);
    }
  }
  
  /**
   * 注册多个资源
   * @param resources 资源数组
   */
  async registerResources(resources: RuntimeResource[]): Promise<{ success: number, failed: number, errors: string[] }> {
    const result = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const resource of resources) {
      try {
        await this.registerResource(resource);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push(error.message);
      }
    }
    
    return result;
  }
  
  /**
   * 加载并注册文件中的所有资源
   * @param filePath 文件路径
   */
  async loadAndRegister(filePath: string): Promise<{ success: number, failed: number, errors: string[] }> {
    const resources = await this.loadFile(filePath);
    return this.registerResources(resources);
  }
  
  /**
   * 获取指定类型的所有资源
   * @param kind 资源类型
   */
  getResourcesByKind(kind: string): RuntimeResource[] {
    return Array.from(this.resources.values())
      .filter(resource => resource.kind === kind);
  }
  
  /**
   * 按名称获取资源
   * @param kind 资源类型
   * @param name 资源名称
   * @param namespace 命名空间，默认为default
   */
  getResource(kind: string, name: string, namespace: string = 'default'): RuntimeResource | undefined {
    const key = `${kind}.${namespace}.${name}`;
    return this.resources.get(key);
  }
  
  /**
   * 获取资源键
   */
  private getResourceKey(resource: RuntimeResource): string {
    const namespace = resource.metadata.namespace || 'default';
    return `${resource.kind}.${namespace}.${resource.metadata.name}`;
  }
  
  /**
   * 验证自定义资源
   * @param resource 资源对象
   */
  validateCustomResource(resource: RuntimeResource): boolean {
    try {
      return this.runtimeManager.validateCustomResource(resource);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 获取资源验证错误
   * @param resource 资源对象
   */
  getValidationErrors(resource: RuntimeResource): string | object {
    try {
      const errors: string | null = this.runtimeManager.getCustomResourceValidationErrors(resource);
      
      // 如果是ZodError格式的错误，尝试提取关键信息
      if (errors !== null && typeof errors === 'object') {
        // @ts-ignore - TypeScript is not understanding our null check properly
        if ('issues' in errors) {
          // 转换为更友好的格式
          return this._formatZodErrors(errors);
        }
      }
      
      // 返回错误信息或默认消息
      return errors !== null ? errors : '无验证错误';
    } catch (error) {
      // 确保返回的是字符串或者格式化的对象
      return error.message || String(error);
    }
  }
  
  /**
   * 格式化Zod验证错误
   * @param zodError Zod错误对象 
   * @private
   */
  private _formatZodErrors(zodError: any): object {
    if (!zodError || !zodError.issues || !Array.isArray(zodError.issues)) {
      return { message: '未知验证错误' };
    }
    
    // 构建更友好的错误结构
    const formattedErrors = {
      summary: '资源验证失败',
      details: (zodError.issues || []).map((issue: any) => {
        const errorInfo: Record<string, any> = {
          message: issue.message
        };
        
        // 添加路径信息（如果存在）
        if (issue.path && Array.isArray(issue.path) && issue.path.length > 0) {
          errorInfo.field = issue.path.join('.');
        }
        
        // 添加特定类型的错误信息
        if (issue.code === 'invalid_enum_value' && issue.options) {
          errorInfo.allowedValues = issue.options;
          errorInfo.receivedValue = issue.received;
        }
        
        return errorInfo;
      })
    };
    
    return formattedErrors;
  }
}

/**
 * 快速创建一个简化的资源管理器
 */
export function createSimpleResourceManager(): SimpleResourceManager {
  return new SimpleResourceManager();
}

/**
 * 从文件加载资源的简便方法
 * @param filePath 文件路径
 */
export async function loadResources(filePath: string): Promise<RuntimeResource[]> {
  const manager = new SimpleResourceManager();
  return manager.loadFile(filePath);
}

/**
 * 快速加载并注册资源
 * @param filePath 文件路径
 */
export async function loadAndRegister(filePath: string): Promise<RuntimeManager> {
  const manager = new SimpleResourceManager();
  await manager.loadAndRegister(filePath);
  return manager.runtimeManager;
} 