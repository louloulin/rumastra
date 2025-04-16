import { join, resolve, dirname } from 'path';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { glob } from 'glob';
import { 
  RuntimeResource, 
  MastraPodSchema, 
  resolveEnvVariables,
  AgentResourceSchema,
  WorkflowResourceSchema,
  NetworkResourceSchema,
  ToolResourceSchema,
  CustomResourceDefinitionSchema,
  LLMResourceSchema
} from '../types';

/**
 * DSL解析器 - 处理YAML资源文件
 */
export class DSLParser {
  private resourceCache = new Map<string, RuntimeResource>();
  private loadingStack = new Set<string>(); // 检测循环引用
  private customResourceSchemas = new Map<string, any>();
  
  /**
   * 解析YAML文件为运行时资源
   */
  async parseFile(filePath: string): Promise<RuntimeResource> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * 解析YAML内容
   */
  parseContent(content: string): RuntimeResource {
    try {
      const resource = yaml.load(content) as RuntimeResource;
      this.validateResource(resource);
      return resource;
    } catch (error) {
      throw new Error(`Invalid YAML content: ${(error as Error).message}`);
    }
  }

  /**
   * 验证资源结构
   */
  validateResource(resource: RuntimeResource): void {
    if (!resource.kind || !resource.apiVersion) {
      throw new Error('Resource must include kind and apiVersion');
    }

    switch (resource.kind) {
      case 'Agent':
        AgentResourceSchema.parse(resource);
        break;
      case 'Workflow':
        WorkflowResourceSchema.parse(resource);
        break;
      case 'Network':
        NetworkResourceSchema.parse(resource);
        break;
      case 'Tool':
        ToolResourceSchema.parse(resource);
        break;
      case 'CustomResourceDefinition':
        CustomResourceDefinitionSchema.parse(resource);
        this.registerCustomResourceDefinition(resource);
        break;
      case 'LLM':
        LLMResourceSchema.parse(resource);
        break;
      default:
        // 检查是否为已注册的自定义资源
        const crdKey = this.getCRDKey(resource.apiVersion, resource.kind);
        if (this.customResourceSchemas.has(crdKey)) {
          try {
            const schema = this.customResourceSchemas.get(crdKey);
            schema.parse(resource);
          } catch (error) {
            throw new Error(`Invalid custom resource ${resource.kind}: ${(error as Error).message}`);
          }
        } else {
          throw new Error(`Unknown resource kind: ${resource.kind}`);
        }
    }
  }

  /**
   * 扫描目录获取所有资源
   */
  async scanDirectory(dirPath: string): Promise<RuntimeResource[]> {
    const resources: RuntimeResource[] = [];
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = join(dirPath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile()) {
            try {
              const resource = await this.parseFile(filePath);
              resources.push(resource);
            } catch (error) {
              console.warn(`Warning: Failed to parse ${filePath} - ${(error as Error).message}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dirPath}: ${(error as Error).message}`);
    }
    
    return resources;
  }

  /**
   * 解析MastraPod配置
   */
  async parseMastraPod(filePath: string): Promise<{
    podConfig: any;
    resources: RuntimeResource[];
  }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const podYaml = yaml.load(content) as any;
    
    // 验证MastraPod结构
    MastraPodSchema.parse(podYaml);
    
    // 处理环境变量和全局配置
    const podConfig = {
      providers: resolveEnvVariables(podYaml.providers || {}),
      memory: resolveEnvVariables(podYaml.memory || {}),
      logging: resolveEnvVariables(podYaml.logging || {})
    };
    
    // 加载资源
    const resources: RuntimeResource[] = [];
    const baseDir = dirname(filePath);
    
    for (const resourceDef of podYaml.resources) {
      if ('file' in resourceDef) {
        // 加载单个文件
        const resourcePath = resolve(baseDir, resourceDef.file);
        
        // 处理条件加载
        if (resourceDef.when !== undefined) {
          const condition = resolveEnvVariables(resourceDef.when);
          if (!condition) continue;
        }
        
        const resource = await this.loadResourceFile(resourcePath, baseDir);
        if (resource) {
          resources.push(resource);
        }
      } 
      else if ('directory' in resourceDef) {
        // 加载整个目录
        const dirPath = resolve(baseDir, resourceDef.directory);
        const pattern = resourceDef.pattern || '*.{yaml,yml}';
        const files = await glob(join(dirPath, pattern));
        
        for (const file of files) {
          const resource = await this.loadResourceFile(file, baseDir);
          if (resource) {
            resources.push(resource);
          }
        }
      }
      else {
        // 内联定义
        this.validateResource(resourceDef);
        resources.push(resourceDef);
      }
    }
    
    // 处理引用解析
    this.resolveReferences(resources);
    
    return {
      podConfig,
      resources
    };
  }
  
  /**
   * 加载资源文件
   */
  private async loadResourceFile(filePath: string, baseDir: string): Promise<RuntimeResource | null> {
    if (this.loadingStack.has(filePath)) {
      throw new Error(`Circular reference detected: ${filePath}`);
    }
    
    if (this.resourceCache.has(filePath)) {
      return this.resourceCache.get(filePath)!;
    }
    
    try {
      this.loadingStack.add(filePath);
      
      const content = await fs.readFile(filePath, 'utf-8');
      const resource = yaml.load(content) as RuntimeResource;
      
      this.validateResource(resource);
      
      // 处理嵌套引用
      if ('$ref' in resource) {
        const refPath = resolve(baseDir, resource.$ref as string);
        const referencedResource = await this.loadResourceFile(refPath, baseDir);
        this.resourceCache.set(filePath, referencedResource!);
        this.loadingStack.delete(filePath);
        return referencedResource;
      }
      
      this.resourceCache.set(filePath, resource);
      this.loadingStack.delete(filePath);
      return resource;
    } catch (error) {
      this.loadingStack.delete(filePath);
      console.warn(`Failed to load resource ${filePath}: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * 解析引用关系
   */
  private resolveReferences(resources: RuntimeResource[]): void {
    const resourceMap = new Map<string, RuntimeResource>();
    
    // 构建资源查找映射
    for (const resource of resources) {
      const key = `${resource.kind}/${resource.metadata.name}`;
      resourceMap.set(key, resource);
    }
    
    // 解析引用
    for (const resource of resources) {
      this.resolveResourceReferences(resource, resourceMap);
    }
  }
  
  /**
   * 在资源中解析引用
   */
  private resolveResourceReferences(resource: any, resourceMap: Map<string, any>): void {
    for (const key in resource) {
      const value = resource[key];
      
      if (value && typeof value === 'object') {
        if ('$ref' in value && typeof value.$ref === 'string') {
          const [kind, name] = value.$ref.split('/');
          const refKey = `${kind}/${name}`;
          
          if (resourceMap.has(refKey)) {
            // 替换引用为实际资源
            resource[key] = resourceMap.get(refKey);
          } else {
            throw new Error(`Unable to resolve reference: ${value.$ref}`);
          }
        } else {
          // 递归解析嵌套对象
          this.resolveResourceReferences(value, resourceMap);
        }
      }
    }
  }

  /**
   * 注册自定义资源定义
   */
  private registerCustomResourceDefinition(crd: any): void {
    const { group, names, validation } = crd.spec;
    const { kind } = names;
    
    // 创建自定义资源的Schema
    // 实际实现中，应该解析openAPIV3Schema并构建Zod Schema
    // 此处简化为基本验证
    const crdKey = this.getCRDKey(`${group}/v1`, kind);
    
    // 临时简化实现，仅校验基本结构
    this.customResourceSchemas.set(crdKey, {
      parse: (resource: any) => {
        if (!resource.apiVersion || !resource.kind || !resource.metadata) {
          throw new Error('Invalid custom resource structure');
        }
        return resource;
      }
    });
    
    console.log(`Registered custom resource definition: ${group}/${kind}`);
  }
  
  /**
   * 获取CRD的唯一键
   */
  private getCRDKey(apiVersion: string, kind: string): string {
    // 确保正确处理 apiVersion (可能是 'group/version' 格式)
    return `${apiVersion.includes('/') ? apiVersion : `${apiVersion}/v1`}/${kind}`;
  }
} 