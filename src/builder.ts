import { Agent, Mastra, Workflow } from '@mastra/core';
import { RootConfig, AgentConfig, WorkflowConfig } from './types';
import { validateRootConfig } from './types/root';
import { 
  dynamicImport, 
  ConfigError, 
  ExecutionError, 
  logError, 
  handleAsyncError
} from './utils';
import { createToolExecutor, validateToolScript } from './toolExecutor';
import path from 'path';

/**
 * 运行时构建器 - 负责从配置构建Mastra实例
 */
export class RuntimeBuilder {
  private config: RootConfig;
  private toolInstances: Record<string, any> = {};
  private agentInstances: Record<string, Agent> = {};
  private workflowInstances: Record<string, Workflow> = {};
  private basePath: string;

  /**
   * 构造函数
   * @param config 配置对象
   * @param basePath 基础路径
   */
  constructor(config: any, basePath: string = process.cwd()) {
    try {
      // 验证配置
      this.config = validateRootConfig(config);
      this.basePath = basePath;
    } catch (error) {
      throw new ConfigError(
        `Invalid configuration: ${error instanceof Error ? error.message : String(error)}`,
        { config }
      );
    }
  }

  /**
   * 构建 Mastra 实例
   */
  async build(): Promise<Mastra> {
    try {
      // 1. 加载工具
      if (this.config.tools) {
        await this.buildTools();
      }

      // 2. 构建智能体
      await this.buildAgents();

      // 3. 构建工作流
      if (this.config.workflows) {
        await this.buildWorkflows();
      }

      // 4. 创建 Mastra 实例
      return new Mastra({
        agents: this.agentInstances,
        workflows: this.workflowInstances,
      });
    } catch (error) {
      logError(error, 'RuntimeBuilder.build');
      throw new ConfigError(
        `Failed to build Mastra instance: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  /**
   * 构建工具实例
   */
  private async buildTools(): Promise<void> {
    for (const [name, toolConfig] of Object.entries(this.config.tools || {})) {
      try {
        console.log(`Building tool: ${name} from ${toolConfig.execute}`);
        
        // 解析工具路径
        const toolPath = toolConfig.execute.startsWith('.')
          ? path.resolve(this.basePath, toolConfig.execute)
          : toolConfig.execute;
        
        // 验证工具脚本
        const isValid = await validateToolScript(toolPath);
        if (!isValid) {
          console.warn(`Tool script may not be in correct format: ${toolPath}`);
        }
        
        // 创建工具执行函数
        const executeFunc = await createToolExecutor(toolPath);

        // 创建工具实例
        this.toolInstances[name] = {
          id: toolConfig.id || name,
          description: toolConfig.description,
          inputSchema: toolConfig.inputSchema,
          outputSchema: toolConfig.outputSchema,
          execute: executeFunc,
        };
        
        console.log(`Successfully loaded tool: ${name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ConfigError(`Failed to build tool ${name}: ${errorMessage}`, { 
          toolName: name, 
          toolConfig,
          error
        });
      }
    }
  }

  /**
   * 构建智能体实例
   */
  private async buildAgents(): Promise<void> {
    for (const [name, agentConfig] of Object.entries(this.config.agents)) {
      try {
        this.agentInstances[name] = await this.buildAgent(agentConfig);
        console.log(`Successfully built agent: ${name}`);
      } catch (error) {
        logError(error, `RuntimeBuilder.buildAgents[${name}]`);
        throw new ConfigError(`Failed to build agent ${name}: ${error instanceof Error ? error.message : String(error)}`, {
          agentName: name,
          agentConfig,
          error
        });
      }
    }
  }

  /**
   * 构建单个智能体
   */
  private async buildAgent(config: AgentConfig): Promise<Agent> {
    // 1. 加载模型
    const [model, modelError] = await handleAsyncError(this.loadModel(config.model));
    
    if (modelError) {
      throw new ConfigError(`Failed to load model for agent ${config.name}: ${modelError.message}`, {
        model: config.model,
        error: modelError
      });
    }

    // 2. 收集工具
    const tools: Record<string, any> = {};
    if (config.tools) {
      for (const [toolName, toolId] of Object.entries(config.tools)) {
        if (this.toolInstances[toolId]) {
          tools[toolName] = this.toolInstances[toolId];
        } else {
          throw new ConfigError(`Tool not found: ${toolId}`, { 
            toolId, 
            availableTools: Object.keys(this.toolInstances) 
          });
        }
      }
    }

    // 3. 构建内存和语音组件
    const [memory, memoryError] = config.memory?.enabled 
      ? await handleAsyncError(this.buildMemory(config.memory))
      : [undefined, null];
      
    if (memoryError) {
      console.warn(`Failed to build memory for agent ${config.name}: ${memoryError.message}`);
    }
    
    const [voice, voiceError] = config.voice?.enabled 
      ? await handleAsyncError(this.buildVoice(config.voice))
      : [undefined, null];
      
    if (voiceError) {
      console.warn(`Failed to build voice for agent ${config.name}: ${voiceError.message}`);
    }

    // 4. 创建智能体
    return new Agent({
      name: config.name,
      instructions: config.instructions,
      model,
      tools,
      memory,
      voice,
    });
  }

  /**
   * 构建工作流实例
   */
  private async buildWorkflows(): Promise<void> {
    for (const [name, workflowConfig] of Object.entries(this.config.workflows || {})) {
      try {
        const workflow = this.buildWorkflow(workflowConfig);
        this.workflowInstances[name] = workflow;
        console.log(`Successfully built workflow: ${name}`);
      } catch (error) {
        logError(error, `RuntimeBuilder.buildWorkflows[${name}]`);
        throw new ConfigError(`Failed to build workflow ${name}: ${error instanceof Error ? error.message : String(error)}`, {
          workflowName: name,
          workflowConfig,
          error
        });
      }
    }
  }

  /**
   * 构建单个工作流
   */
  private buildWorkflow(config: WorkflowConfig): Workflow {
    // 验证初始步骤存在
    const hasInitialStep = config.steps.some(step => step.id === config.initialStep);
    if (!hasInitialStep) {
      throw new ConfigError(`Initial step '${config.initialStep}' not found in workflow steps`, {
        initialStep: config.initialStep,
        availableSteps: config.steps.map(s => s.id)
      });
    }

    // 将步骤转换为工作流格式
    const workflowSteps = config.steps.map(step => {
      // 验证步骤使用的代理存在
      const agentId = step.agentId || step.agent;
      if (!agentId) {
        throw new ConfigError(`No agent specified for step '${step.id}'`, { step });
      }
      
      const agent = this.agentInstances[agentId];
      if (!agent) {
        throw new ConfigError(`Agent not found for step '${step.id}': ${agentId}`, {
          stepId: step.id,
          agentId,
          availableAgents: Object.keys(this.agentInstances)
        });
      }

      return {
        id: step.id,
        name: step.name,
        agent,
        input: step.input,
        output: step.output,
        next: step.next || (step.transitions?.next ? [step.transitions.next] : undefined),
      };
    });

    // 创建工作流
    return new Workflow({
      name: config.name,
      description: config.description,
      initialStep: config.initialStep,
      steps: workflowSteps,
    });
  }

  /**
   * 加载语言模型
   */
  private async loadModel(modelConfig: AgentConfig['model']): Promise<any> {
    try {
      // 尝试加载模型提供者
      const providerModule = await dynamicImport(`@ai-sdk/${modelConfig.provider}`, this.basePath);
      const provider = providerModule.default || providerModule;
      return provider(modelConfig.name);
    } catch (error) {
      // 开发环境下使用mock模型
      console.warn(`Failed to load model provider: ${modelConfig.provider}. Using mock model instead.`);
      console.warn(`Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回模拟模型
      return { 
        provider: modelConfig.provider, 
        name: modelConfig.name,
        type: 'mock',
        generate: async (prompt: string) => ({ 
          response: `[Mock ${modelConfig.name}] Response to: ${prompt}` 
        }),
        stream: async function*(prompt: string) {
          yield `[Mock ${modelConfig.name}] Streaming response to: ${prompt}`;
        }
      };
    }
  }

  /**
   * 构建内存配置
   */
  private async buildMemory(memoryConfig: NonNullable<AgentConfig['memory']>): Promise<any> {
    if (!memoryConfig.enabled) return undefined;

    try {
      const { type = 'memory', config = {} } = memoryConfig;
      const memoryModule = await dynamicImport(`@mastra/${type}`, this.basePath);
      const MemoryClass = memoryModule.default || memoryModule;
      return new MemoryClass(config);
    } catch (error) {
      throw new ConfigError(`Failed to build memory component: ${error instanceof Error ? error.message : String(error)}`, {
        memoryConfig,
        error
      });
    }
  }

  /**
   * 构建语音配置
   */
  private async buildVoice(voiceConfig: NonNullable<AgentConfig['voice']>): Promise<any> {
    if (!voiceConfig.enabled) return undefined;

    try {
      const { provider = 'voice', config = {} } = voiceConfig;
      const voiceModule = await dynamicImport(`@mastra/${provider}`, this.basePath);
      const VoiceClass = voiceModule.default || voiceModule;
      return new VoiceClass(config);
    } catch (error) {
      throw new ConfigError(`Failed to build voice component: ${error instanceof Error ? error.message : String(error)}`, {
        voiceConfig,
        error
      });
    }
  }

  /**
   * 获取构建好的工具
   */
  getTools(): Record<string, any> {
    return { ...this.toolInstances };
  }

  /**
   * 获取构建好的智能体
   */
  getAgents(): Record<string, Agent> {
    return { ...this.agentInstances };
  }

  /**
   * 获取构建好的工作流
   */
  getWorkflows(): Record<string, Workflow> {
    return { ...this.workflowInstances };
  }

  /**
   * 获取指定工具
   */
  getTool(id: string): any {
    return this.toolInstances[id];
  }

  /**
   * 获取指定智能体
   */
  getAgent(id: string): Agent | undefined {
    return this.agentInstances[id];
  }

  /**
   * 获取指定工作流
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflowInstances[id];
  }
}
