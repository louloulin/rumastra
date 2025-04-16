import { EventEmitter } from 'events';
import {
  RuntimeResource,
  AgentResource,
  WorkflowResource,
  NetworkResource
} from '../types';
import { RuntimeManager } from './runtime-manager';
import { DSLParser } from './dsl-parser';

/**
 * CLI运行时管理器
 * 用于连接CLI命令与运行时系统
 */
export class CLIRuntimeManager extends EventEmitter {
  private runtimeManager: RuntimeManager;
  private parser: DSLParser;
  
  constructor() {
    super();
    this.runtimeManager = new RuntimeManager();
    this.parser = new DSLParser();
  }
  
  /**
   * 初始化运行时
   */
  async initialize(): Promise<void> {
    // 初始化运行时管理器
    await this.runtimeManager.initialize();
    
    // 转发运行时事件
    this.setupEventForwarding();
  }
  
  /**
   * 设置事件转发
   */
  private setupEventForwarding(): void {
    // 将运行时管理器的事件转发到CLI运行时管理器
    const eventsToForward = [
      'resource:added',
      'resource:updated',
      'resource:deleted',
      'workflow:start',
      'workflow:complete',
      'workflow:error',
      'network:start',
      'network:message',
      'network:complete',
      'network:error',
      'step:start',
      'step:complete'
    ];
    
    for (const event of eventsToForward) {
      this.runtimeManager.on(event, (data) => {
        this.emit(event, data);
      });
    }
  }
  
  /**
   * 应用全局配置
   */
  async applyGlobalConfig(config: any): Promise<void> {
    if (!config) return;
    
    // 应用提供商配置
    if (config.providers) {
      for (const provider in config.providers) {
        const providerConfig = config.providers[provider];
        
        // 设置环境变量
        if (provider === 'openai' && providerConfig.apiKey) {
          process.env.OPENAI_API_KEY = providerConfig.apiKey;
        } else if (provider === 'anthropic' && providerConfig.apiKey) {
          process.env.ANTHROPIC_API_KEY = providerConfig.apiKey;
        }
        
        // 将配置传递给运行时管理器
        await this.runtimeManager.setProviderConfig(provider, providerConfig);
      }
    }
    
    // 应用内存配置
    if (config.memory) {
      await this.runtimeManager.setMemoryConfig(config.memory);
    }
    
    // 应用日志配置
    if (config.logging) {
      // 配置日志系统
      const level = config.logging.level || 'info';
      console.log(`Setting log level to ${level}`);
    }
  }
  
  /**
   * 加载资源
   */
  async loadResource(resource: RuntimeResource): Promise<void> {
    try {
      await this.runtimeManager.addResource(resource);
      console.log(`Resource ${resource.kind}/${resource.metadata.name} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load resource ${resource.kind}/${resource.metadata.name}: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 执行工作流
   */
  async executeWorkflow(resource: WorkflowResource): Promise<void> {
    try {
      const workflowExecutor = this.runtimeManager.getWorkflowExecutor();
      
      workflowExecutor.on('step:start', (data) => {
        this.emit('step:start', data);
        console.log(`Starting workflow step: ${data.stepId}`);
      });
      
      workflowExecutor.on('step:complete', (data) => {
        this.emit('step:complete', data);
        console.log(`Completed workflow step: ${data.stepId}`);
      });
      
      workflowExecutor.on('workflow:complete', (data) => {
        this.emit('workflow:complete', data);
        console.log(`Workflow completed: ${data.workflowId}`);
      });
      
      workflowExecutor.on('workflow:error', (data) => {
        this.emit('workflow:error', data);
        console.error(`Workflow error: ${data.error}`);
      });
      
      await workflowExecutor.execute(resource);
    } catch (error) {
      console.error(`Failed to execute workflow: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 执行网络
   */
  async executeNetwork(resource: NetworkResource): Promise<void> {
    try {
      const networkExecutor = this.runtimeManager.getNetworkExecutor();
      
      networkExecutor.on('network:start', (data) => {
        this.emit('network:start', data);
        console.log(`Starting network: ${data.networkId}`);
      });
      
      networkExecutor.on('network:message', (data) => {
        this.emit('network:message', data);
        console.log(`Network message from ${data.from} to ${data.to}: ${data.message.substring(0, 50)}...`);
      });
      
      networkExecutor.on('network:complete', (data) => {
        this.emit('network:complete', data);
        console.log(`Network completed: ${data.networkId}`);
      });
      
      networkExecutor.on('network:error', (data) => {
        this.emit('network:error', data);
        console.error(`Network error: ${data.error}`);
      });
      
      await networkExecutor.execute(resource);
    } catch (error) {
      console.error(`Failed to execute network: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 执行智能体
   */
  async executeAgent(resource: AgentResource | string, input?: string): Promise<string> {
    try {
      let agentName: string;
      
      if (typeof resource === 'string') {
        agentName = resource;
      } else {
        agentName = resource.metadata.name;
        
        // 确保智能体已加载
        await this.loadResource(resource);
      }
      
      const result = await this.runtimeManager.executeAgent(
        agentName, 
        input || ''
      );
      
      return result;
    } catch (error) {
      console.error(`Failed to execute agent: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.runtimeManager.shutdown();
    console.log('Runtime resources cleaned up');
  }
  
  /**
   * 解析DSL文件
   */
  parseFile(filePath: string): Promise<RuntimeResource> {
    return this.parser.parseFile(filePath);
  }
  
  /**
   * 解析DSL内容
   */
  parseContent(content: string): RuntimeResource {
    return this.parser.parseContent(content);
  }
  
  /**
   * 扫描目录获取所有资源
   */
  scanDirectory(dirPath: string): Promise<RuntimeResource[]> {
    return this.parser.scanDirectory(dirPath);
  }
  
  /**
   * 解析MastraPod配置
   */
  async parseMastraPod(filePath: string): Promise<{
    podConfig: any;
    resources: RuntimeResource[];
  }> {
    return this.parser.parseMastraPod(filePath);
  }
} 