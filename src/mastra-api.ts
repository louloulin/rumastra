import { readFile } from 'fs/promises';
import { load, loadAll } from 'js-yaml';
import { join, resolve, dirname } from 'path';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { Agent } from '@mastra/core';
import { v4 as uuidv4 } from 'uuid';

import { 
  resolveEnvVariables, 
  handleAsyncError, 
  logError,
  ExecutionError,
  ValidationError,
  NotFoundError
} from './utils';
import { SimpleResourceManager } from './simple-api';
import { 
  RuntimeResource, 
  WorkflowResource, 
  AgentResource, 
  ToolResource,
  NetworkResource,
  LLMResource,
  MastraPod as MastraPodType,
  MastraPodOptions,
  MastraPodLoadOptions,
  AgentRunOptions,
  WorkflowRunOptions,
  ToolCallOptions,
  AgentResponse,
  WorkflowResponse,
  ToolResponse,
  RunOptions
} from './types';

/**
 * MastraPod类 - 高级API入口点，用于简化Mastra YAML DSL的加载和运行
 */
export class MastraPod extends EventEmitter {
  private resourceManager: SimpleResourceManager;
  private resources: Map<string, RuntimeResource> = new Map();
  private executions: Map<string, any> = new Map();
  private metadata: Record<string, any> = {};
  private env: Record<string, string> = {};
  
  /**
   * 创建MastraPod实例
   * @param options 配置选项
   */
  constructor(options: MastraPodOptions = {}) {
    super();
    this.resourceManager = new SimpleResourceManager();
    
    // 设置环境变量
    this.env = options.env || process.env;
    
    // 监听运行时事件
    this.setupEventListeners();
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    const runtimeManager = this.resourceManager.runtimeManager;
    
    // 监听资源添加事件
    runtimeManager.on('resource:added', (resource: RuntimeResource) => {
      const key = this.getResourceKey(resource);
      this.resources.set(key, resource);
      this.emit('resource:added', { resource });
    });
    
    // 监听工作流事件
    runtimeManager.on('workflow:step:started', (data: any) => {
      this.emit('workflow:step:started', data);
    });
    
    runtimeManager.on('workflow:step:completed', (data: any) => {
      this.emit('workflow:step:completed', data);
    });
    
    runtimeManager.on('workflow:completed', (data: any) => {
      this.emit('workflow:completed', data);
    });
    
    // 监听代理事件
    runtimeManager.on('agent:executing', (data: any) => {
      this.emit('agent:executing', data);
    });
    
    runtimeManager.on('agent:executed', (data: any) => {
      this.emit('agent:executed', data);
    });

    // 确保清理资源
    process.on('beforeExit', () => {
      this.cleanup();
    });
  }
  
  /**
   * 获取资源唯一键
   */
  private getResourceKey(resource: RuntimeResource): string {
    const namespace = resource.metadata?.namespace || 'default';
    return `${resource.kind}.${namespace}.${resource.metadata?.name}`;
  }
  
  /**
   * 从YAML文件加载MastraPod
   * @param filePath YAML文件路径
   * @param options 加载选项
   */
  static async loadFile(filePath: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
    const pod = new MastraPod({
      env: options.env
    });
    
    await pod.addFile(filePath);
    return pod;
  }
  
  /**
   * 从YAML内容加载MastraPod
   * @param content YAML内容
   * @param options 加载选项
   */
  static async loadContent(content: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
    const pod = new MastraPod({
      env: options.env
    });
    
    await pod.addContent(content);
    return pod;
  }
  
  /**
   * 创建新的应用程序实例
   */
  static createApp(options: MastraPodOptions = {}): MastraPod {
    return new MastraPod(options);
  }
  
  /**
   * 使用默认配置创建MastraPod
   * @param defaults 默认配置
   */
  static withDefaults(defaults: Record<string, any>): MastraPod {
    const pod = new MastraPod({ 
      env: defaults.env,
    });
    
    // 设置默认元数据
    if (defaults.metadata) {
      pod.metadata = { ...defaults.metadata };
    }
    
    return pod;
  }
  
  /**
   * 添加YAML文件到MastraPod
   * @param filePath 文件路径
   */
  async addFile(filePath: string): Promise<MastraPod> {
    try {
      const [content, readError] = await handleAsyncError(readFile(filePath, 'utf-8'));
      
      if (readError) {
        throw new ValidationError(`Failed to read file ${filePath}: ${readError.message}`, { 
          filePath, 
          error: readError 
        });
      }
      
      return this.addContent(content as string);
    } catch (error) {
      logError(error, `MastraPod.addFile(${filePath})`);
      throw error instanceof Error ? error : new Error(`Failed to load file ${filePath}: ${String(error)}`);
    }
  }
  
  /**
   * 添加YAML内容到MastraPod
   * @param content YAML内容
   */
  async addContent(content: string): Promise<MastraPod> {
    try {
      const resources = this.parseYAML(content);
      await this.registerResources(resources);
      return this;
    } catch (error) {
      logError(error, 'MastraPod.addContent');
      throw error instanceof Error ? error : new Error(`Failed to parse YAML content: ${String(error)}`);
    }
  }
  
  /**
   * 扫描目录中的所有YAML文件
   * @param dirPath 目录路径
   * @param pattern 可选的glob模式，默认为标准YAML扩展名
   */
  async scanDirectory(dirPath: string, pattern?: string): Promise<MastraPod> {
    const defaultPattern = "**/*.{yaml,yml}";
    const fullPattern = join(dirPath, pattern || defaultPattern);
    
    try {
      const files = await glob(fullPattern);
      
      for (const file of files) {
        try {
          await this.addFile(file);
        } catch (error) {
          console.warn(`Error loading file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return this;
    } catch (error) {
      logError(error, `MastraPod.scanDirectory(${dirPath})`);
      throw new Error(`Failed to scan directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 解析YAML内容
   * @param content YAML内容
   */
  parseYAML(content: string): RuntimeResource[] {
    try {
      const resources: RuntimeResource[] = [];
      
      // 处理多文档YAML
      try {
        const docs = loadAll(content);
        
        for (const doc of docs) {
          if (doc && typeof doc === 'object' && 'kind' in doc) {
            resources.push(doc as RuntimeResource);
          }
        }
      } catch (error) {
        // 如果多文档解析失败，尝试作为单个文档解析
        const doc = load(content) as unknown;
        
        if (doc && typeof doc === 'object') {
          if ('kind' in doc) {
            // 单个资源
            resources.push(doc as RuntimeResource);
          } else if (Array.isArray(doc)) {
            // 资源数组
            for (const item of doc) {
              if (item && typeof item === 'object' && 'kind' in item) {
                resources.push(item as RuntimeResource);
              }
            }
          }
        }
      }
      
      // 处理环境变量
      const processedResources = resources.map(resource => this.resolveEnvVariables(resource));
      
      // 添加必要的元数据
      return processedResources.map(resource => this.fixResourceMetadata(resource));
    } catch (error) {
      throw new ValidationError(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`, { error });
    }
  }
  
  /**
   * 处理环境变量
   * @param obj 需要处理环境变量的对象
   */
  private resolveEnvVariables(obj: any): any {
    if (typeof obj === 'string') {
      return this.resolveEnvString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvVariables(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.resolveEnvVariables(obj[key]);
        }
      }
      
      return result;
    }
    
    return obj;
  }
  
  /**
   * 解析字符串中的环境变量
   * @param str 包含环境变量的字符串
   */
  private resolveEnvString(str: string): string {
    return str.replace(/\${([^}]+)}/g, (match, envVarName) => {
      const envValue = this.env[envVarName];
      return envValue !== undefined ? envValue : match;
    });
  }
  
  /**
   * 修复资源元数据
   * @param resource 需要修复的资源
   */
  private fixResourceMetadata(resource: RuntimeResource): RuntimeResource {
    if (!resource.metadata) {
      resource.metadata = { name: `resource-${Date.now()}` };
    }
    
    if (!resource.metadata.namespace) {
      resource.metadata.namespace = 'default';
    }
    
    if (!resource.apiVersion) {
      resource.apiVersion = 'mastra.ai/v1';
    }
    
    return resource;
  }
  
  /**
   * 注册资源
   * @param resources 资源列表
   */
  async registerResources(resources: RuntimeResource[]): Promise<void> {
    for (const resource of resources) {
      try {
        await this.resourceManager.addResource(resource);
      } catch (error) {
        console.warn(`Failed to register resource ${resource.kind}/${resource.metadata?.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * 运行代理
   * @param agentName 代理名称
   * @param input 输入内容
   * @param options 运行选项
   */
  async runAgent(
    agentName: string, 
    input: string | Record<string, any>,
    options: AgentRunOptions = {}
  ): Promise<AgentResponse> {
    const namespace = options.namespace || 'default';
    const executionId = options.executionId || `agent-${uuidv4()}`;
    
    try {
      // 获取代理实例
      const agent = this.getAgent(agentName, namespace);
      
      if (!agent) {
        throw new NotFoundError('Agent', `${namespace}/${agentName}`);
      }
      
      // 格式化输入
      const formattedInput = typeof input === 'string' 
        ? { input } 
        : input;
        
      // 执行代理
      console.log(`Running agent: ${agentName} (${executionId})`);
      const result = await agent.execute(formattedInput);
      
      // 保存结果
      const response: AgentResponse = {
        executionId,
        result,
        agent: agentName,
        status: 'completed'
      };
      
      this.executions.set(executionId, response);
      this.emit('agent:completed', { agentName, executionId, result });
      
      return response;
    } catch (error) {
      // 处理错误
      logError(error, `MastraPod.runAgent(${namespace}/${agentName})`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const response: AgentResponse = {
        executionId,
        error: errorMessage,
        agent: agentName,
        status: 'failed'
      };
      
      this.executions.set(executionId, response);
      this.emit('agent:failed', { agentName, executionId, error });
      
      return response;
    }
  }
  
  /**
   * 运行工作流
   * @param workflowName 工作流名称
   * @param input 输入内容
   * @param options 运行选项
   */
  async runWorkflow(
    workflowName: string, 
    input: Record<string, any> = {},
    options: WorkflowRunOptions = {}
  ): Promise<WorkflowResponse> {
    const namespace = options.namespace || 'default';
    const executionId = options.executionId || `workflow-${uuidv4()}`;
    
    try {
      // 获取工作流
      const workflow = this.resourceManager.getWorkflow(workflowName, namespace);
      
      if (!workflow) {
        throw new NotFoundError('Workflow', `${namespace}/${workflowName}`);
      }
      
      // 获取工作流执行器
      const workflowModule = await this.resourceManager.getWorkflowController(workflow);
      
      if (!workflowModule) {
        throw new ExecutionError(`Failed to create workflow controller for ${workflowName}`);
      }
      
      // 设置步骤回调
      const stepResults: Record<string, any> = {};
      
      workflowModule.on('step:completed', (data: any) => {
        const { stepId, output } = data;
        stepResults[stepId] = output;
        this.emit('workflow:step:completed', { 
          workflowName, 
          executionId, 
          stepId, 
          output 
        });
      });
      
      // 执行工作流
      console.log(`Running workflow: ${workflowName} (${executionId})`);
      const result = await workflowModule.execute(input);
      
      // 保存结果
      const response: WorkflowResponse = {
        executionId,
        result,
        workflow: workflowName,
        status: 'completed'
      };
      
      this.executions.set(executionId, response);
      this.emit('workflow:completed', { 
        workflowName, 
        executionId, 
        result,
        steps: stepResults
      });
      
      return response;
    } catch (error) {
      // 处理错误
      logError(error, `MastraPod.runWorkflow(${namespace}/${workflowName})`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const response: WorkflowResponse = {
        executionId,
        error: errorMessage,
        workflow: workflowName,
        status: 'failed'
      };
      
      this.executions.set(executionId, response);
      this.emit('workflow:failed', { 
        workflowName, 
        executionId, 
        error: errorMessage 
      });
      
      return response;
    }
  }
  
  /**
   * 调用工具
   * @param toolName 工具名称
   * @param params 参数
   * @param options 调用选项
   */
  async callTool(
    toolName: string,
    params: Record<string, any> = {},
    options: ToolCallOptions = {}
  ): Promise<ToolResponse> {
    const namespace = options.namespace || 'default';
    const executionId = options.executionId || `tool-${uuidv4()}`;
    
    try {
      // 获取工具
      const tool = await this.resourceManager.getTool(toolName, namespace);
      
      if (!tool) {
        throw new NotFoundError('Tool', `${namespace}/${toolName}`);
      }
      
      if (!tool.execute || typeof tool.execute !== 'function') {
        throw new ExecutionError(`Tool ${toolName} does not have a valid execute function`);
      }
      
      // 执行工具
      console.log(`Calling tool: ${toolName} (${executionId})`);
      const result = await tool.execute(params);
      
      // 保存结果
      const response: ToolResponse = {
        executionId,
        result,
        tool: toolName,
        status: 'completed'
      };
      
      this.executions.set(executionId, response);
      this.emit('tool:completed', { 
        toolName, 
        executionId, 
        params, 
        result 
      });
      
      return response;
    } catch (error) {
      // 处理错误
      logError(error, `MastraPod.callTool(${namespace}/${toolName})`);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const response: ToolResponse = {
        executionId,
        error: errorMessage,
        tool: toolName,
        status: 'failed'
      };
      
      this.executions.set(executionId, response);
      this.emit('tool:failed', { 
        toolName, 
        executionId, 
        params, 
        error: errorMessage 
      });
      
      return response;
    }
  }
  
  /**
   * 获取执行结果
   * @param executionId 执行ID
   */
  getResult(executionId: string): any {
    return this.executions.get(executionId);
  }
  
  /**
   * 获取资源
   * @param kind 资源类型
   * @param name 资源名称
   * @param namespace 命名空间
   */
  getResource(kind: string, name: string, namespace: string = 'default'): RuntimeResource | undefined {
    const key = `${kind}.${namespace}.${name}`;
    return this.resources.get(key);
  }
  
  /**
   * 按类型获取资源
   * @param kind 资源类型
   * @param namespace 命名空间
   */
  getResourcesByKind(kind: string, namespace?: string): RuntimeResource[] {
    const resources: RuntimeResource[] = [];
    
    for (const [key, resource] of this.resources.entries()) {
      if (resource.kind === kind && (!namespace || resource.metadata?.namespace === namespace)) {
        resources.push(resource);
      }
    }
    
    return resources;
  }
  
  /**
   * 获取代理实例
   * @param name 代理名称
   * @param namespace 命名空间
   */
  getAgent(name: string, namespace: string = 'default'): Agent | null {
    try {
      return this.resourceManager.getAgent(name, namespace);
    } catch (error) {
      console.warn(`Failed to get agent ${namespace}/${name}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * 获取代理资源
   * @param namespace 命名空间
   */
  getAgents(namespace?: string): AgentResource[] {
    return this.getResourcesByKind('Agent', namespace) as AgentResource[];
  }
  
  /**
   * 获取工作流资源
   * @param namespace 命名空间
   */
  getWorkflows(namespace?: string): WorkflowResource[] {
    return this.getResourcesByKind('Workflow', namespace) as WorkflowResource[];
  }
  
  /**
   * 获取工具资源
   * @param namespace 命名空间
   */
  getTools(namespace?: string): ToolResource[] {
    return this.getResourcesByKind('Tool', namespace) as ToolResource[];
  }
  
  /**
   * 获取网络资源
   * @param namespace 命名空间
   */
  getNetworks(namespace?: string): NetworkResource[] {
    return this.getResourcesByKind('Network', namespace) as NetworkResource[];
  }
  
  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      // 移除监听器
      this.removeAllListeners();
      
      // 清理资源管理器
      await this.resourceManager.cleanup();
      
      // 清空资源映射
      this.resources.clear();
      this.executions.clear();
    } catch (error) {
      console.error(`Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 运行配置
 * @param options 运行选项
 */
export async function run(options: RunOptions): Promise<WorkflowResponse | AgentResponse> {
  let pod: MastraPod;
  
  try {
    // 从文件或内容加载
    if (options.file) {
      pod = await MastraPod.loadFile(options.file, { env: options.env });
    } else if (options.content) {
      pod = await MastraPod.loadContent(options.content, { env: options.env });
    } else {
      throw new ValidationError('Either file or content must be provided');
    }
    
    // 运行工作流或代理
    if (options.workflow) {
      return await pod.runWorkflow(options.workflow, options.input || {});
    } else if (options.agent) {
      return await pod.runAgent(options.agent, options.input || {});
    } else {
      throw new ValidationError('Either workflow or agent must be specified');
    }
  } catch (error) {
    logError(error, 'MastraPod.run');
    
    // 返回错误响应
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (options.workflow) {
      return {
        executionId: `workflow-${uuidv4()}`,
        error: errorMessage,
        workflow: options.workflow || 'unknown',
        status: 'failed'
      };
    } else {
      return {
        executionId: `agent-${uuidv4()}`,
        error: errorMessage,
        agent: options.agent || 'unknown',
        status: 'failed'
      };
    }
  }
}

// 公共API导出
export async function loadFile(filePath: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
  return MastraPod.loadFile(filePath, options);
}

export async function loadContent(content: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
  return MastraPod.loadContent(content, options);
}

export function createApp(options: MastraPodOptions = {}): MastraPod {
  return MastraPod.createApp(options);
} 
} 