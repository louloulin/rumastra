/**
 * 生成结果接口
 */
export interface GenerationResult {
  text: string;
  [key: string]: any;
}

/**
 * 流式生成结果接口
 */
export interface StreamResult {
  [key: string]: any;
}

/**
 * 网络生成选项
 */
export interface NetworkGenerateOptions {
  /**
   * 初始状态
   */
  initialState?: Record<string, any>;
  
  /**
   * 步骤限制
   */
  maxSteps?: number;
  
  /**
   * 温度参数
   */
  temperature?: number;

  /**
   * 是否启用执行追踪
   */
  enableTracing?: boolean;

  /**
   * 路由策略
   */
  routingStrategy?: RoutingStrategy;
}

/**
 * 网络流式生成选项
 */
export interface NetworkStreamOptions {
  /**
   * 初始状态
   */
  initialState?: Record<string, any>;
  
  /**
   * 步骤限制
   */
  maxSteps?: number;
  
  /**
   * 温度参数
   */
  temperature?: number;
  
  /**
   * 完成回调
   */
  onFinish?: (result: any) => void;

  /**
   * 是否启用执行追踪
   */
  enableTracing?: boolean;

  /**
   * 路由策略
   */
  routingStrategy?: RoutingStrategy;
}

/**
 * 执行追踪记录
 */
export interface ExecutionTraceRecord {
  /**
   * 记录ID
   */
  id: string;
  
  /**
   * 步骤编号
   */
  step: number;
  
  /**
   * 代理ID
   */
  agentId: string;
  
  /**
   * 输入
   */
  input: string;
  
  /**
   * 输出
   */
  output: string;
  
  /**
   * 开始时间
   */
  startTime: number;
  
  /**
   * 结束时间
   */
  endTime: number;
  
  /**
   * 延迟时间(毫秒)
   */
  latency: number;
  
  /**
   * 是否路由调用
   */
  isRouterCall: boolean;
  
  /**
   * 相关状态更新
   */
  stateChanges?: Record<string, any>;
}

/**
 * 执行追踪摘要
 */
export interface ExecutionTraceSummary {
  /**
   * 记录总数
   */
  totalCalls: number;
  
  /**
   * 路由调用次数
   */
  routerCalls: number;
  
  /**
   * 代理调用次数
   */
  agentCalls: number;
  
  /**
   * 每个代理调用次数
   */
  callsByAgent: Record<string, number>;
  
  /**
   * 总延迟时间
   */
  totalLatency: number;
  
  /**
   * 平均延迟时间
   */
  averageLatency: number;
  
  /**
   * 最大延迟时间
   */
  maxLatency: number;
  
  /**
   * 步骤总数
   */
  totalSteps: number;
}

/**
 * 路由策略枚举
 */
export enum RoutingStrategy {
  /**
   * 默认策略 - 使用路由代理决定
   */
  DEFAULT = 'default',
  
  /**
   * 轮询 - 依次使用每个代理
   */
  ROUND_ROBIN = 'round-robin',
  
  /**
   * 基于历史 - 根据代理历史表现选择
   */
  HISTORY_BASED = 'history-based',
  
  /**
   * 语义匹配 - 根据语义相似度匹配代理
   */
  SEMANTIC_MATCHING = 'semantic-matching',
  
  /**
   * 自定义策略
   */
  CUSTOM = 'custom'
}

/**
 * 自定义路由策略处理器
 */
export interface CustomRoutingHandler {
  /**
   * 选择下一个代理
   * @param input 用户输入
   * @param agents 可用代理
   * @param state 当前状态
   * @param history 历史记录
   * @returns 选择的代理ID
   */
  selectNextAgent: (
    input: string,
    agents: Map<string, any>,
    state: Record<string, any>,
    history: ExecutionTraceRecord[]
  ) => Promise<string>;
} 