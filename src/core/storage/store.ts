import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { RuntimeResource } from '../../types';
import { DatabaseStateStore } from './database-store';

/**
 * 状态存储接口
 */
export interface StateStore {
  /**
   * 获取单个资源
   */
  getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null>;
  
  /**
   * 保存单个资源
   */
  saveResource(resource: RuntimeResource): Promise<void>;
  
  /**
   * 删除单个资源
   */
  deleteResource(kind: string, namespace: string, name: string): Promise<boolean>;
  
  /**
   * 获取所有特定类型的资源
   */
  listResources(kind: string, namespace?: string): Promise<RuntimeResource[]>;
  
  /**
   * 监听资源变化
   */
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void };
}

/**
 * 内存存储实现
 */
export class InMemoryStateStore extends EventEmitter implements StateStore {
  private resources: Map<string, RuntimeResource> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * 获取资源键
   */
  private getResourceKey(kind: string, namespace: string, name: string): string {
    return `${kind}.${namespace}.${name}`;
  }
  
  /**
   * 获取单个资源
   */
  async getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null> {
    const key = this.getResourceKey(kind, namespace, name);
    return this.resources.get(key) || null;
  }
  
  /**
   * 保存单个资源
   */
  async saveResource(resource: RuntimeResource): Promise<void> {
    const { kind } = resource;
    const namespace = resource.metadata.namespace || 'default';
    const { name } = resource.metadata;
    
    const key = this.getResourceKey(kind, namespace, name);
    const isNew = !this.resources.has(key);
    
    this.resources.set(key, resource);
    
    // 触发事件
    const eventType = isNew ? 'ADDED' : 'MODIFIED';
    this.emit(`${kind}.change`, eventType, resource);
  }
  
  /**
   * 删除单个资源
   */
  async deleteResource(kind: string, namespace: string, name: string): Promise<boolean> {
    const key = this.getResourceKey(kind, namespace, name);
    const resource = this.resources.get(key);
    
    if (resource) {
      this.resources.delete(key);
      // 触发删除事件
      this.emit(`${kind}.change`, 'DELETED', resource);
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取所有特定类型的资源
   */
  async listResources(kind: string, namespace?: string): Promise<RuntimeResource[]> {
    const result: RuntimeResource[] = [];
    
    for (const [key, resource] of this.resources.entries()) {
      if (resource.kind === kind) {
        if (!namespace || resource.metadata.namespace === namespace) {
          result.push(resource);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 监听资源变化
   */
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void } {
    const listener = (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => {
      handler(event, resource);
    };
    
    this.on(`${kind}.change`, listener);
    
    return {
      unsubscribe: () => {
        this.off(`${kind}.change`, listener);
      }
    };
  }
}

/**
 * 文件系统存储实现
 */
export class FileSystemStateStore extends EventEmitter implements StateStore {
  private basePath: string;
  private watchIntervalMs = 1000; // 文件系统轮询间隔
  private watchTimers: Map<string, NodeJS.Timeout> = new Map();
  private resourceCache: Map<string, { resource: RuntimeResource, mtime: Date }> = new Map();
  
  constructor(basePath: string) {
    super();
    this.basePath = basePath;
    // 确保目录存在
    fs.ensureDirSync(this.basePath);
  }
  
  /**
   * 获取资源文件路径
   */
  private getResourceFilePath(kind: string, namespace: string, name: string): string {
    const kindDir = path.join(this.basePath, kind.toLowerCase());
    const namespaceDir = path.join(kindDir, namespace);
    
    // 确保目录存在
    fs.ensureDirSync(namespaceDir);
    
    return path.join(namespaceDir, `${name}.json`);
  }
  
  /**
   * 获取资源键
   */
  private getResourceKey(kind: string, namespace: string, name: string): string {
    return `${kind}.${namespace}.${name}`;
  }
  
  /**
   * 获取单个资源
   */
  async getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null> {
    const filePath = this.getResourceFilePath(kind, namespace, name);
    
    try {
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as RuntimeResource;
      }
    } catch (error) {
      console.error(`Failed to read resource ${kind}/${namespace}/${name}:`, error);
    }
    
    return null;
  }
  
  /**
   * 保存单个资源
   */
  async saveResource(resource: RuntimeResource): Promise<void> {
    const { kind } = resource;
    const namespace = resource.metadata.namespace || 'default';
    const { name } = resource.metadata;
    
    const filePath = this.getResourceFilePath(kind, namespace, name);
    const key = this.getResourceKey(kind, namespace, name);
    const isNew = !(await fs.pathExists(filePath));
    
    try {
      // 保存资源到文件
      await fs.writeJson(filePath, resource, { spaces: 2 });
      
      // 更新缓存
      const stats = await fs.stat(filePath);
      this.resourceCache.set(key, { resource, mtime: stats.mtime });
      
      // 触发事件
      const eventType = isNew ? 'ADDED' : 'MODIFIED';
      this.emit(`${kind}.change`, eventType, resource);
    } catch (error) {
      console.error(`Failed to save resource ${kind}/${namespace}/${name}:`, error);
      throw error;
    }
  }
  
  /**
   * 删除单个资源
   */
  async deleteResource(kind: string, namespace: string, name: string): Promise<boolean> {
    const filePath = this.getResourceFilePath(kind, namespace, name);
    const key = this.getResourceKey(kind, namespace, name);
    
    try {
      if (await fs.pathExists(filePath)) {
        // 获取当前资源内容
        const content = await fs.readFile(filePath, 'utf-8');
        const resource = JSON.parse(content) as RuntimeResource;
        
        // 删除文件
        await fs.remove(filePath);
        
        // 从缓存中移除
        this.resourceCache.delete(key);
        
        // 触发事件
        this.emit(`${kind}.change`, 'DELETED', resource);
        return true;
      }
    } catch (error) {
      console.error(`Failed to delete resource ${kind}/${namespace}/${name}:`, error);
    }
    
    return false;
  }
  
  /**
   * 获取所有特定类型的资源
   */
  async listResources(kind: string, namespace?: string): Promise<RuntimeResource[]> {
    const result: RuntimeResource[] = [];
    const kindDir = path.join(this.basePath, kind.toLowerCase());
    
    try {
      // 确认类型目录存在
      if (!(await fs.pathExists(kindDir))) {
        return [];
      }
      
      // 获取所有命名空间目录
      const namespaceDirs = namespace 
        ? [path.join(kindDir, namespace)] 
        : (await fs.readdir(kindDir)).map(ns => path.join(kindDir, ns));
      
      // 遍历每个命名空间目录
      for (const nsDir of namespaceDirs) {
        // 跳过不存在的目录
        if (!(await fs.pathExists(nsDir))) {
          continue;
        }
        
        const files = await fs.readdir(nsDir);
        
        // 读取每个资源文件
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(nsDir, file);
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const resource = JSON.parse(content) as RuntimeResource;
              result.push(resource);
            } catch (error) {
              console.warn(`Failed to read resource file ${filePath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list ${kind} resources:`, error);
    }
    
    return result;
  }
  
  /**
   * 检查文件变化
   */
  private async checkForChanges(kind: string): Promise<void> {
    const kindDir = path.join(this.basePath, kind.toLowerCase());
    
    try {
      // 确认类型目录存在
      if (!(await fs.pathExists(kindDir))) {
        return;
      }
      
      // 获取所有命名空间目录
      const namespaceDirs = (await fs.readdir(kindDir)).map(ns => path.join(kindDir, ns));
      
      // 收集当前文件路径
      const currentFilePaths = new Set<string>();
      
      // 遍历每个命名空间目录
      for (const nsDir of namespaceDirs) {
        // 跳过不存在的目录
        if (!(await fs.pathExists(nsDir))) {
          continue;
        }
        
        const files = await fs.readdir(nsDir);
        
        // 检查每个资源文件
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(nsDir, file);
            currentFilePaths.add(filePath);
            
            try {
              const stats = await fs.stat(filePath);
              const fileName = path.basename(file, '.json');
              const namespace = path.basename(nsDir);
              const key = this.getResourceKey(kind, namespace, fileName);
              
              // 检查缓存中是否存在且修改时间是否变化
              const cached = this.resourceCache.get(key);
              
              if (!cached || stats.mtime.getTime() !== cached.mtime.getTime()) {
                // 文件已更新，读取新内容
                const content = await fs.readFile(filePath, 'utf-8');
                const resource = JSON.parse(content) as RuntimeResource;
                
                // 更新缓存
                this.resourceCache.set(key, { resource, mtime: stats.mtime });
                
                // 触发事件
                const eventType = !cached ? 'ADDED' : 'MODIFIED';
                // 克隆资源对象以确保测试中的objectContaining能正常工作
                const clonedResource = JSON.parse(JSON.stringify(resource));
                this.emit(`${kind}.change`, eventType, clonedResource);
              }
            } catch (error) {
              console.warn(`Failed to process resource file ${filePath}:`, error);
            }
          }
        }
      }
      
      // 检查删除的资源
      for (const [key, { resource }] of this.resourceCache.entries()) {
        if (resource.kind === kind) {
          const namespace = resource.metadata.namespace || 'default';
          const { name } = resource.metadata;
          const filePath = this.getResourceFilePath(kind, namespace, name);
          
          if (!currentFilePaths.has(filePath)) {
            // 文件已删除
            this.resourceCache.delete(key);
            // 克隆资源对象以确保测试中的objectContaining能正常工作
            const clonedResource = JSON.parse(JSON.stringify(resource));
            this.emit(`${kind}.change`, 'DELETED', clonedResource);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to check for changes in ${kind} resources:`, error);
    }
  }
  
  /**
   * 监听资源变化
   */
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void } {
    // 停止现有的监听
    if (this.watchTimers.has(kind)) {
      clearInterval(this.watchTimers.get(kind)!);
    }
    
    // 设置事件监听
    const listener = (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => {
      handler(event, resource);
    };
    this.on(`${kind}.change`, listener);
    
    // 开始文件系统轮询
    const timer = setInterval(() => {
      this.checkForChanges(kind).catch(error => {
        console.error(`Error checking for ${kind} changes:`, error);
      });
    }, this.watchIntervalMs);
    
    this.watchTimers.set(kind, timer);
    
    // 立即执行一次检查
    this.checkForChanges(kind).catch(error => {
      console.error(`Error checking for ${kind} changes:`, error);
    });
    
    return {
      unsubscribe: () => {
        this.off(`${kind}.change`, listener);
        
        // 如果没有其他监听器，停止轮询
        if (this.listenerCount(`${kind}.change`) === 0) {
          clearInterval(this.watchTimers.get(kind)!);
          this.watchTimers.delete(kind);
        }
      }
    };
  }
}

export { DatabaseStateStore } from './database-store';

/**
 * 创建状态存储实例的工厂函数
 */
export function createStateStore(config: 
  | { type: 'memory' } 
  | { type: 'filesystem', path: string }
  | { type: 'database', path: string }
): StateStore {
  if (config.type === 'memory') {
    return new InMemoryStateStore();
  } else if (config.type === 'filesystem') {
    return new FileSystemStateStore(config.path);
  } else if (config.type === 'database') {
    try {
      // Import dynamically to avoid dependency issues if SQLite is not installed
      return new DatabaseStateStore({ path: config.path });
    } catch (error) {
      console.error('Failed to initialize database state store:', error);
      console.warn('Falling back to in-memory state store');
      return new InMemoryStateStore();
    }
  } else {
    throw new Error('Unsupported state store type');
  }
} 