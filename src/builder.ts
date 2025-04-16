import { Agent, Mastra, Workflow } from '@mastra/core';
import type { RootConfig, AgentConfig, WorkflowConfig } from './types';
import { dynamicImport } from './utils';
import { createToolExecutor, validateToolScript } from './toolExecutor';
import path from 'path';

export class RuntimeBuilder {
  private config: RootConfig;
  private toolInstances: Record<string, any> = {};
  private agentInstances: Record<string, Agent> = {};
  private workflowInstances: Record<string, Workflow> = {};
  private basePath: string;

  constructor(config: RootConfig, basePath: string = process.cwd()) {
    this.config = config;
    this.basePath = basePath;
  }

  /**
   * 构建 Mastra 实例
   */
  async build(): Promise<Mastra> {
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
  }

  /**
   * 构建工具实例
   */
  private async buildTools(): Promise<void> {
    for (const [name, toolConfig] of Object.entries(this.config.tools || {})) {
      try {
        console.log(`Building tool: ${name} from ${toolConfig.execute}`);
        
        // Resolve tool path if relative
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load tool ${name}:`, errorMessage);
        throw new Error(`Failed to build tool ${name}: ${errorMessage}`);
      }
    }
  }

  /**
   * 构建智能体实例
   */
  private async buildAgents(): Promise<void> {
    for (const [name, agentConfig] of Object.entries(this.config.agents)) {
      this.agentInstances[name] = await this.buildAgent(agentConfig);
      console.log(`Successfully built agent: ${name}`);
    }
  }

  /**
   * 构建单个智能体
   */
  private async buildAgent(config: AgentConfig): Promise<Agent> {
    // 1. 加载模型
    const model = await this.loadModel(config.model);

    // 2. 收集工具
    const tools: Record<string, any> = {};
    if (config.tools) {
      for (const [toolName, toolId] of Object.entries(config.tools)) {
        if (this.toolInstances[toolId]) {
          tools[toolName] = this.toolInstances[toolId];
        } else {
          throw new Error(`Tool not found: ${toolId}`);
        }
      }
    }

    // 3. 创建智能体
    return new Agent({
      name: config.name,
      instructions: config.instructions,
      model,
      tools,
      memory: config.memory ? await this.buildMemory(config.memory) : undefined,
      voice: config.voice ? await this.buildVoice(config.voice) : undefined,
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
        console.error(`Error building workflow ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * 构建单个工作流
   */
  private buildWorkflow(config: WorkflowConfig): Workflow {
    // 将步骤转换为工作流格式
    const workflowSteps = config.steps.map(step => {
      const agent = this.agentInstances[step.agent];
      if (!agent) {
        throw new Error(`Agent not found: ${step.agent}`);
      }

      return {
        id: step.id,
        name: step.name,
        agent,
        input: step.input,
        output: step.output,
        next: step.next,
      };
    });

    // 创建工作流的参数
    const workflowParams = {
      name: config.name,
      initialStep: config.initialStep,
      steps: workflowSteps,
    };

    // 添加可选描述
    if (config.description) {
      Object.assign(workflowParams, { description: config.description });
    }

    // 创建工作流实例
    return new Workflow(workflowParams as any);
  }

  /**
   * 加载语言模型
   */
  private async loadModel(modelConfig: AgentConfig['model']): Promise<any> {
    try {
      const providerModule = await dynamicImport(`@ai-sdk/${modelConfig.provider}`, this.basePath);
      const provider = providerModule.default || providerModule;
      return provider(modelConfig.name);
    } catch (error) {
      // 开发环境下可以使用mock模型
      console.warn(`Failed to load model provider: ${modelConfig.provider}. Using mock model instead.`);
      return { provider: modelConfig.provider, name: modelConfig.name };
    }
  }

  /**
   * 构建内存配置
   */
  private async buildMemory(memoryConfig: NonNullable<AgentConfig['memory']>): Promise<any> {
    if (!memoryConfig.enabled) return undefined;

    try {
      const { type, config = {} } = memoryConfig;
      const memoryModule = await dynamicImport(`@mastra/${type}`, this.basePath);
      const MemoryClass = memoryModule.default || memoryModule;
      return new MemoryClass(config);
    } catch (error) {
      console.warn(`Failed to load memory: ${memoryConfig.type}. Memory will not be available.`);
      return undefined;
    }
  }

  /**
   * 构建语音配置
   */
  private async buildVoice(voiceConfig: NonNullable<AgentConfig['voice']>): Promise<any> {
    if (!voiceConfig.enabled) return undefined;

    try {
      const { provider, config = {} } = voiceConfig;
      const voiceModule = await dynamicImport(`@mastra/voice-${provider}`, this.basePath);
      const VoiceClass = voiceModule.default || voiceModule;
      return new VoiceClass(config);
    } catch (error) {
      console.warn(`Failed to load voice provider: ${voiceConfig.provider}. Voice will not be available.`);
      return undefined;
    }
  }

  /**
   * 获取构建好的工具实例
   */
  getTools(): Record<string, any> {
    return this.toolInstances;
  }

  /**
   * 获取构建好的智能体实例
   */
  getAgents(): Record<string, Agent> {
    return this.agentInstances;
  }

  /**
   * 获取构建好的工作流实例
   */
  getWorkflows(): Record<string, Workflow> {
    return this.workflowInstances;
  }

  /**
   * 获取特定工具实例
   */
  getTool(id: string): any {
    return this.toolInstances[id];
  }

  /**
   * 获取特定智能体实例
   */
  getAgent(id: string): Agent | undefined {
    return this.agentInstances[id];
  }

  /**
   * 获取特定工作流实例
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflowInstances[id];
  }
}
