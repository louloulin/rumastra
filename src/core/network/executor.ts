import { Agent } from '@mastra/core';
import { NetworkResource } from '../../types';
import { NetworkState } from './state';
import { 
  GenerationResult, 
  StreamResult, 
  NetworkGenerateOptions, 
  NetworkStreamOptions,
  ExecutionTraceRecord,
  ExecutionTraceSummary,
  RoutingStrategy,
  CustomRoutingHandler
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { AgentInfo, enhanceAgentInfo } from './agent-info';

/**
 * 网络执行器
 * 负责执行网络中的代理调用和路由逻辑
 */
export class NetworkExecutor {
  private network: NetworkResource;
  private agents: Map<string, Agent>;
  private router: Agent;
  private state: NetworkState;
  private stepCount: number = 0;
  private executionTraces: ExecutionTraceRecord[] = [];
  private customRoutingHandler?: CustomRoutingHandler;
  private currentRoutingStrategy: RoutingStrategy = RoutingStrategy.DEFAULT;
  private agentRoundRobinIndex: number = 0;
  private agentPerformanceData: Map<string, { 
    successCount: number, 
    failureCount: number, 
    avgLatency: number,
    totalCalls: number
  }> = new Map();
  
  /**
   * 创建一个网络执行器
   * @param network 网络资源定义
   * @param agents 代理映射，键为代理名称，值为代理实例
   * @param router 路由器代理实例
   */
  constructor(network: NetworkResource, agents: Map<string, Agent>, router: Agent) {
    this.network = network;
    this.agents = agents;
    this.router = router;
    this.state = new NetworkState({});
    
    // 初始化代理性能数据
    this.agents.forEach((_, name) => {
      this.agentPerformanceData.set(name, {
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
        totalCalls: 0
      });
    });
  }
  
  /**
   * 设置自定义路由策略处理器
   * @param handler 自定义路由处理器
   */
  setCustomRoutingHandler(handler: CustomRoutingHandler): void {
    this.customRoutingHandler = handler;
  }
  
  /**
   * 执行网络生成
   * @param input 输入文本
   * @param options 生成选项
   * @returns 生成结果
   */
  async generate(input: string, options?: NetworkGenerateOptions): Promise<GenerationResult> {
    // 设置初始状态
    if (options?.initialState) {
      this.state.update(options.initialState);
    }
    
    // 重置步骤计数和执行追踪
    this.stepCount = 0;
    this.executionTraces = [];
    
    // 设置路由策略
    if (options?.routingStrategy) {
      this.currentRoutingStrategy = options.routingStrategy;
    } else {
      this.currentRoutingStrategy = RoutingStrategy.DEFAULT;
    }
    
    // 获取步骤限制
    const maxSteps = options?.maxSteps || this.network.spec.router.maxSteps;
    
    // 构建路由器工具
    const routerTools = this.buildRouterTools();
    
    // 添加网络说明到输入
    const enhancedInput = this.enhanceInput(input);
    
    // 记录路由器执行开始
    const routerTraceId = uuidv4();
    const routerStartTime = Date.now();
    
    // 执行路由器生成 - 直接调用Agent的实现
    const result = await this.router.generate(enhancedInput, {
      toolsets: routerTools,
      temperature: options?.temperature,
      maxSteps: maxSteps
    });
    
    // 记录路由器执行结束
    if (options?.enableTracing) {
      const routerEndTime = Date.now();
      const routerLatency = routerEndTime - routerStartTime;
      
      this.executionTraces.push({
        id: routerTraceId,
        step: 0,
        agentId: 'router',
        input: enhancedInput,
        output: result instanceof Object && 'text' in result ? result.text : String(result),
        startTime: routerStartTime,
        endTime: routerEndTime,
        latency: routerLatency,
        isRouterCall: true,
        stateChanges: this.state.toObject()
      });
    }
    
    // 更新网络资源状态
    if (this.network.status) {
      this.network.status.stepCount = this.stepCount;
      this.network.status.lastExecutionTime = new Date().toISOString();
      
      // 添加执行统计信息
      if (options?.enableTracing) {
        this.network.status.lastExecutionSummary = this.generateExecutionSummary();
      }
    }
    
    // 在结果中附加执行追踪信息
    const generationResult = result as GenerationResult;
    if (options?.enableTracing) {
      generationResult.traces = this.executionTraces;
      generationResult.traceSummary = this.generateExecutionSummary();
    }
    
    return generationResult;
  }
  
  /**
   * 执行网络流式生成
   * @param input 输入文本
   * @param options 流式生成选项
   * @returns 流式生成结果
   */
  async stream(input: string, options?: NetworkStreamOptions): Promise<StreamResult> {
    // 设置初始状态
    if (options?.initialState) {
      this.state.update(options.initialState);
    }
    
    // 重置步骤计数和执行追踪
    this.stepCount = 0;
    this.executionTraces = [];
    
    // 设置路由策略
    if (options?.routingStrategy) {
      this.currentRoutingStrategy = options.routingStrategy;
    } else {
      this.currentRoutingStrategy = RoutingStrategy.DEFAULT;
    }
    
    // 获取步骤限制
    const maxSteps = options?.maxSteps || this.network.spec.router.maxSteps;
    
    // 构建路由器工具
    const routerTools = this.buildRouterTools();
    
    // 添加网络说明到输入
    const enhancedInput = this.enhanceInput(input);
    
    // 记录路由器执行开始
    const routerTraceId = uuidv4();
    const routerStartTime = Date.now();
    
    // 设置更新网络状态的回调函数
    const onFinishWithStateUpdate = (result: any) => {
      // 记录路由器执行结束
      if (options?.enableTracing) {
        const routerEndTime = Date.now();
        const routerLatency = routerEndTime - routerStartTime;
        
        this.executionTraces.push({
          id: routerTraceId,
          step: 0,
          agentId: 'router',
          input: enhancedInput,
          output: result instanceof Object && 'text' in result ? result.text : String(result),
          startTime: routerStartTime,
          endTime: routerEndTime,
          latency: routerLatency,
          isRouterCall: true,
          stateChanges: this.state.toObject()
        });
      }
      
      // 更新网络资源状态
      if (this.network.status) {
        this.network.status.stepCount = this.stepCount;
        this.network.status.lastExecutionTime = new Date().toISOString();
        
        // 添加执行统计信息
        if (options?.enableTracing) {
          this.network.status.lastExecutionSummary = this.generateExecutionSummary();
        }
      }
      
      // 调用原始的完成回调
      if (options?.onFinish) {
        // 在结果中附加执行追踪信息
        if (options?.enableTracing && result instanceof Object) {
          result.traces = this.executionTraces;
          result.traceSummary = this.generateExecutionSummary();
        }
        
        options.onFinish(result);
      }
    };
    
    // 执行路由器流式生成 - 直接调用Agent的实现
    const result = await this.router.stream(enhancedInput, {
      toolsets: routerTools,
      temperature: options?.temperature,
      maxSteps: maxSteps,
      onFinish: onFinishWithStateUpdate
    });
    
    return result as StreamResult;
  }
  
  /**
   * 获取当前网络状态
   * @returns 网络状态对象
   */
  getState(): Record<string, any> {
    return this.state.toObject();
  }
  
  /**
   * 更新网络状态
   * @param state 部分或完整状态
   */
  updateState(state: Record<string, any>): void {
    this.state.update(state);
  }
  
  /**
   * 获取步骤计数
   * @returns 步骤计数
   */
  getStepCount(): number {
    return this.stepCount;
  }
  
  /**
   * 获取可用的代理列表
   * @returns 代理名称数组
   */
  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }
  
  /**
   * 获取执行追踪记录
   * @returns 执行追踪记录数组
   */
  getExecutionTraces(): ExecutionTraceRecord[] {
    return [...this.executionTraces];
  }
  
  /**
   * 获取执行追踪摘要
   * @returns 执行追踪摘要
   */
  getExecutionSummary(): ExecutionTraceSummary {
    return this.generateExecutionSummary();
  }
  
  /**
   * 根据路由策略选择下一个代理
   * @param input 用户输入
   * @returns 选择的代理名称
   */
  private async selectNextAgent(input: string): Promise<string> {
    const agentNames = Array.from(this.agents.keys());
    
    switch (this.currentRoutingStrategy) {
      case RoutingStrategy.ROUND_ROBIN:
        // 轮询策略 - 依次选择每个代理
        const agentName = agentNames[this.agentRoundRobinIndex];
        this.agentRoundRobinIndex = (this.agentRoundRobinIndex + 1) % agentNames.length;
        return agentName;
        
      case RoutingStrategy.HISTORY_BASED:
        // 基于历史表现选择代理
        let bestAgent = '';
        let bestScore = -1;
        
        this.agentPerformanceData.forEach((data, name) => {
          if (data.totalCalls === 0) return;
          
          // 计算成功率和响应时间得分
          const successRate = data.totalCalls > 0 ? data.successCount / data.totalCalls : 0;
          const latencyScore = data.avgLatency > 0 ? 1000 / data.avgLatency : 0;
          
          // 综合得分 (权重可调整)
          const score = successRate * 0.7 + latencyScore * 0.3;
          
          if (score > bestScore) {
            bestScore = score;
            bestAgent = name;
          }
        });
        
        // 如果没有足够的历史数据，返回随机代理
        return bestAgent || agentNames[Math.floor(Math.random() * agentNames.length)];
        
      case RoutingStrategy.SEMANTIC_MATCHING:
        // 语义匹配策略 - 根据输入内容和代理专长进行匹配
        // 1. 获取每个代理的描述或专长领域
        const agentDescriptions: Map<string, string> = new Map();
        
        // 从网络资源定义中提取代理描述
        if (this.network.spec.agents) {
          this.network.spec.agents.forEach(agentDef => {
            // 检查必要的属性是否存在
            if (agentDef.name && agentDef.ref) {
              // 使用enhanceAgentInfo转换基本代理定义为增强的代理信息
              const agentInfo = enhanceAgentInfo(agentDef as { name: string; ref: string; [key: string]: any }, {
                role: '通用',
                description: `通用代理 ${agentDef.name}`
              });
              
              // 优先使用specialties字段，如果没有则使用description或默认描述
              const description = 
                agentInfo.specialties || 
                agentInfo.description || 
                `专精于${agentInfo.role || '通用'}任务的代理`;
              
              if (agentNames.includes(agentDef.name)) {
                agentDescriptions.set(agentDef.name, description);
              }
            }
          });
        }
        
        // 2. 为没有描述的代理添加默认描述
        agentNames.forEach(name => {
          if (!agentDescriptions.has(name)) {
            agentDescriptions.set(name, `通用代理 ${name}`);
          }
        });
        
        // 3. 使用简单的关键词匹配算法
        let bestMatch = '';
        let highestScore = -1;
        
        agentDescriptions.forEach((description, name) => {
          // 将输入和描述分词，转成小写方便匹配
          const inputWords = input.toLowerCase().split(/\s+|，|,|。|\.|!|！|、/);
          const descWords = description.toLowerCase().split(/\s+|，|,|。|\.|!|！|、/);
          
          // 计算匹配度分数
          let matchScore = 0;
          
          // 获取代理角色（如果存在）
          const agentDef = this.network.spec.agents?.find(agent => agent.name === name);
          const agentRole = agentDef?.['role'] || '';
          
          // 基于角色的加权匹配
          if (agentRole.includes('客户') && input.includes('账户')) {
            matchScore += 5; // 客户服务代理处理账户查询加权
          }
          
          if (agentRole.includes('财务') && (input.includes('账单') || input.includes('收费'))) {
            matchScore += 5; // 财务代理处理账单查询加权
          }
          
          // 对输入中的每个词，检查它在描述中是否存在
          inputWords.forEach(word => {
            if (word.length <= 2) return; // 忽略太短的词
            
            descWords.forEach(descWord => {
              // 精确匹配得分高
              if (descWord === word) {
                matchScore += 2;
              }
              // 部分匹配也有分数
              else if (descWord.includes(word) || word.includes(descWord)) {
                matchScore += 1;
              }
            });
          });
          
          // 考虑历史表现
          const perfData = this.agentPerformanceData.get(name);
          if (perfData && perfData.totalCalls > 0) {
            const successRate = perfData.successCount / perfData.totalCalls;
            // 历史表现作为加权因子
            matchScore *= (0.5 + 0.5 * successRate);
          }
          
          if (matchScore > highestScore) {
            highestScore = matchScore;
            bestMatch = name;
          }
        });
        
        console.log(`[Semantic Matching] Final selection: ${bestMatch}, Score: ${highestScore}`);
        
        // 如果没有明确匹配，返回随机代理
        return bestMatch || agentNames[Math.floor(Math.random() * agentNames.length)];
        
      case RoutingStrategy.CUSTOM:
        // 自定义路由策略
        if (this.customRoutingHandler) {
          return await this.customRoutingHandler.selectNextAgent(
            input,
            this.agents,
            this.state.toObject(),
            this.executionTraces
          );
        }
        // 如果没有自定义处理器，回退到默认策略
        return agentNames[0];
        
      case RoutingStrategy.DEFAULT:
      default:
        // 默认策略 - 使用第一个代理
        return agentNames[0];
    }
  }
  
  /**
   * 构建路由器工具
   * @returns 工具集合
   */
  private buildRouterTools(): Record<string, Record<string, any>> {
    // 创建代理工具集
    const tools: Record<string, any> = {};
    
    // 为每个代理创建工具
    this.agents.forEach((agent, name) => {
      const toolId = `agent.${name}`;
      tools[toolId] = {
        description: `调用 ${name} 代理解决特定问题`,
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: '发送给代理的消息'
            },
            state: {
              type: 'object',
              description: '可选的状态数据'
            }
          },
          required: ['message']
        },
        execute: async (args: { message: string; state?: Record<string, any> }) => {
          // 增加步骤计数
          this.stepCount++;
          
          // 检查步骤限制
          const maxSteps = this.network.spec.router.maxSteps;
          if (this.stepCount > maxSteps) {
            throw new Error(`超过最大步骤限制 ${maxSteps}`);
          }
          
          // 当前网络状态
          const currentState = this.state.toObject();
          
          // 合并当前状态和传入状态
          const mergedState = {
            ...currentState,
            ...(args.state || {})
          };
          
          // 记录执行开始
          const traceId = uuidv4();
          const startTime = Date.now();
          const stateBeforeExecution = { ...this.state.toObject() };
          
          try {
            // 执行代理生成
            console.log(`[Network] 调用代理 ${name}，步骤 ${this.stepCount}/${maxSteps}`);
            const result = await agent.generate(args.message);
            
            // 获取文本结果
            const response = result instanceof Object && 'text' in result ? result.text : String(result);
            
            // 记录执行结束
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            // 更新代理性能数据
            const perfData = this.agentPerformanceData.get(name);
            if (perfData) {
              perfData.successCount++;
              perfData.totalCalls++;
              // 更新平均延迟
              perfData.avgLatency = (perfData.avgLatency * (perfData.totalCalls - 1) + latency) / perfData.totalCalls;
              this.agentPerformanceData.set(name, perfData);
            }
            
            // 记录执行追踪
            this.executionTraces.push({
              id: traceId,
              step: this.stepCount,
              agentId: name,
              input: args.message,
              output: response,
              startTime,
              endTime,
              latency,
              isRouterCall: false,
              stateChanges: this.getStateDiff(stateBeforeExecution, this.state.toObject())
            });
            
            return {
              response,
              state: mergedState,
              executionTime: latency
            };
          } catch (error) {
            // 记录执行失败
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            // 更新代理性能数据
            const perfData = this.agentPerformanceData.get(name);
            if (perfData) {
              perfData.failureCount++;
              perfData.totalCalls++;
              // 更新平均延迟
              perfData.avgLatency = (perfData.avgLatency * (perfData.totalCalls - 1) + latency) / perfData.totalCalls;
              this.agentPerformanceData.set(name, perfData);
            }
            
            // 记录执行追踪
            this.executionTraces.push({
              id: traceId,
              step: this.stepCount,
              agentId: name,
              input: args.message,
              output: String(error),
              startTime,
              endTime,
              latency,
              isRouterCall: false,
              stateChanges: this.getStateDiff(stateBeforeExecution, this.state.toObject())
            });
            
            // 重新抛出错误
            throw error;
          }
        }
      };
    });
    
    // 添加获取和设置状态的工具
    tools['network.getState'] = {
      description: '获取网络状态中的值',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: '要获取的状态键'
          },
          defaultValue: {
            description: '如果键不存在时的默认值'
          }
        },
        required: ['key']
      },
      execute: async (args: { key: string; defaultValue?: any }) => {
        const value = this.state.get(args.key, args.defaultValue);
        return { value };
      }
    };
    
    tools['network.setState'] = {
      description: '设置网络状态中的值',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: '要设置的状态键'
          },
          value: {
            description: '要存储的值'
          }
        },
        required: ['key', 'value']
      },
      execute: async (args: { key: string; value: any }) => {
        // 记录修改前的状态
        const oldValue = this.state.has(args.key) ? this.state.get(args.key) : undefined;
        
        // 设置新值
        this.state.set(args.key, args.value);
        
        return { 
          success: true,
          oldValue,
          newValue: args.value
        };
      }
    };
    
    // 添加动态路由工具
    tools['network.routeTo'] = {
      description: '动态选择下一个要调用的代理',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: '要处理的输入'
          }
        },
        required: ['input']
      },
      execute: async (args: { input: string }) => {
        const selectedAgent = await this.selectNextAgent(args.input);
        const result = await this.agents.get(selectedAgent)?.generate(args.input);
        
        // 获取文本结果
        const response = result instanceof Object && 'text' in result ? result.text : String(result);
        
        return {
          agentUsed: selectedAgent,
          response,
          state: this.state.toObject()
        };
      }
    };
    
    // 获取执行追踪信息
    tools['network.getExecutionTrace'] = {
      description: '获取执行追踪信息',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'boolean',
            description: '是否只返回摘要信息'
          }
        },
        required: []
      },
      execute: async (args: { summary?: boolean }) => {
        if (args.summary) {
          return this.generateExecutionSummary();
        }
        return {
          traces: this.executionTraces,
          summary: this.generateExecutionSummary()
        };
      }
    };
    
    // 返回工具集
    return { routing: tools };
  }
  
  /**
   * 增强输入，添加网络信息
   * @param input 原始输入
   * @returns 增强后的输入
   */
  private enhanceInput(input: string): string {
    // 创建可用代理的说明
    const agentDescriptions = Array.from(this.agents.entries())
      .map(([name, agent]) => `- ${name}: ${agent.instructions || '无说明'}`)
      .join('\n');
    
    // 增强输入，添加网络说明和可用代理列表
    return `${this.network.spec.instructions || ''}

可用的专家代理:
${agentDescriptions}

用户输入: ${input}`;
  }
  
  /**
   * 生成执行追踪摘要
   * @returns 执行追踪摘要
   */
  private generateExecutionSummary(): ExecutionTraceSummary {
    const agentCalls = this.executionTraces.filter(trace => !trace.isRouterCall);
    const routerCalls = this.executionTraces.filter(trace => trace.isRouterCall);
    
    // 计算每个代理的调用次数
    const callsByAgent: Record<string, number> = {};
    agentCalls.forEach(trace => {
      if (!callsByAgent[trace.agentId]) {
        callsByAgent[trace.agentId] = 0;
      }
      callsByAgent[trace.agentId]++;
    });
    
    // 计算延迟统计
    const latencies = this.executionTraces.map(trace => trace.latency);
    const totalLatency = latencies.reduce((sum, latency) => sum + latency, 0);
    const averageLatency = latencies.length > 0 ? totalLatency / latencies.length : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    
    return {
      totalCalls: this.executionTraces.length,
      routerCalls: routerCalls.length,
      agentCalls: agentCalls.length,
      callsByAgent,
      totalLatency,
      averageLatency,
      maxLatency,
      totalSteps: this.stepCount
    };
  }
  
  /**
   * 获取状态差异
   * @param oldState 旧状态
   * @param newState 新状态
   * @returns 状态差异
   */
  private getStateDiff(oldState: Record<string, any>, newState: Record<string, any>): Record<string, any> {
    const diff: Record<string, any> = {};
    
    // 检查新增或修改的键
    Object.keys(newState).forEach(key => {
      if (!oldState[key] || JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
        diff[key] = newState[key];
      }
    });
    
    // 检查删除的键
    Object.keys(oldState).forEach(key => {
      if (!(key in newState)) {
        diff[key] = null; // 标记为已删除
      }
    });
    
    return diff;
  }
} 