import { EventBus } from '../eventbus';

/**
 * 异步执行配置
 */
export interface AsyncExecutorConfig {
  /**
   * 最大并发操作数
   */
  maxConcurrency?: number;
  
  /**
   * 操作超时时间(毫秒)
   */
  operationTimeoutMs?: number;
  
  /**
   * 队列满时的行为
   * - reject: 拒绝新操作
   * - wait: 等待队列空闲
   */
  queueFullBehavior?: 'reject' | 'wait';
  
  /**
   * 最大队列长度
   */
  maxQueueLength?: number;
  
  /**
   * 是否启用性能监控
   */
  enableMetrics?: boolean;
  
  /**
   * 事件总线
   */
  eventBus?: EventBus;
}

/**
 * 异步执行操作
 */
export interface AsyncOperation<T> {
  /**
   * 操作ID
   */
  id: string;
  
  /**
   * 操作函数
   */
  operation: () => Promise<T>;
  
  /**
   * 优先级
   */
  priority: number;
  
  /**
   * 操作类型
   */
  type: string;
  
  /**
   * 提交时间
   */
  submitTime: number;
  
  /**
   * 开始执行时间
   */
  startTime?: number;
  
  /**
   * 完成时间
   */
  completeTime?: number;
  
  /**
   * 操作上下文数据
   */
  context?: any;
  
  /**
   * 是否取消
   */
  isCancelled?: boolean;
  
  /**
   * 完成回调
   */
  resolve: (result: T) => void;
  
  /**
   * 错误回调
   */
  reject: (error: Error) => void;
}

/**
 * 异步执行器事件
 */
export interface AsyncExecutorEvents {
  'operation:submitted': { id: string; type: string };
  'operation:started': { id: string; type: string };
  'operation:completed': { id: string; type: string; duration: number };
  'operation:failed': { id: string; type: string; error: Error };
  'operation:cancelled': { id: string; type: string };
  'metrics:updated': { metrics: AsyncExecutorMetrics };
}

/**
 * 异步执行器度量
 */
export interface AsyncExecutorMetrics {
  /**
   * 总提交操作数
   */
  totalOperations: number;
  
  /**
   * 总完成操作数
   */
  completedOperations: number;
  
  /**
   * 总失败操作数
   */
  failedOperations: number;
  
  /**
   * 总取消操作数
   */
  cancelledOperations: number;
  
  /**
   * 队列长度
   */
  queueLength: number;
  
  /**
   * 活跃操作数
   */
  activeOperations: number;
  
  /**
   * 平均执行时间(毫秒)
   */
  averageExecutionTimeMs: number;
  
  /**
   * 最短执行时间(毫秒)
   */
  minExecutionTimeMs: number;
  
  /**
   * 最长执行时间(毫秒)
   */
  maxExecutionTimeMs: number;
  
  /**
   * 平均等待时间(毫秒)
   */
  averageWaitTimeMs: number;
  
  /**
   * 操作类型统计
   */
  operationsByType: Record<string, number>;
  
  /**
   * 吞吐量(每秒操作数)
   */
  throughput: number;
  
  /**
   * 开始时间
   */
  startTime: number;
}

/**
 * 异步操作状态
 */
export type AsyncOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 异步操作结果
 */
export interface AsyncOperationResult<T> {
  /**
   * 操作ID
   */
  id: string;
  
  /**
   * 操作状态
   */
  status: AsyncOperationStatus;
  
  /**
   * 操作结果
   */
  result?: T;
  
  /**
   * 错误信息
   */
  error?: Error;
  
  /**
   * 提交时间
   */
  submitTime: number;
  
  /**
   * 开始时间
   */
  startTime?: number;
  
  /**
   * 完成时间
   */
  completeTime?: number;
  
  /**
   * 等待时间(毫秒)
   */
  waitTimeMs?: number;
  
  /**
   * 执行时间(毫秒)
   */
  executionTimeMs?: number;
}

/**
 * 异步执行器
 * 优化性能的异步执行操作管理器
 */
export class AsyncExecutor {
  /**
   * 操作队列
   */
  private queue: AsyncOperation<any>[] = [];
  
  /**
   * 活跃操作集合
   */
  private activeOperations: Set<string> = new Set();
  
  /**
   * 操作结果映射
   */
  private operationResults: Map<string, AsyncOperationResult<any>> = new Map();
  
  /**
   * 执行器配置
   */
  private config: Required<AsyncExecutorConfig>;
  
  /**
   * 事件总线
   */
  private eventBus?: EventBus;
  
  /**
   * 是否正在处理队列
   */
  private isProcessing: boolean = false;
  
  /**
   * 性能指标
   */
  private metrics: AsyncExecutorMetrics = {
    totalOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    cancelledOperations: 0,
    queueLength: 0,
    activeOperations: 0,
    averageExecutionTimeMs: 0,
    minExecutionTimeMs: Infinity,
    maxExecutionTimeMs: 0,
    averageWaitTimeMs: 0,
    operationsByType: {},
    throughput: 0,
    startTime: Date.now()
  };
  
  /**
   * 性能数据收集
   */
  private executionTimes: number[] = [];
  private waitTimes: number[] = [];
  private completedTimestamps: number[] = [];
  
  /**
   * 等待队列空闲的Promise映射
   */
  private waitingResolvers: (() => void)[] = [];
  
  /**
   * 创建异步执行器
   * @param config 配置
   */
  constructor(config: AsyncExecutorConfig = {}) {
    // 设置默认配置
    this.config = {
      maxConcurrency: config.maxConcurrency || 10,
      operationTimeoutMs: config.operationTimeoutMs || 30000,
      queueFullBehavior: config.queueFullBehavior || 'reject',
      maxQueueLength: config.maxQueueLength || 1000,
      enableMetrics: config.enableMetrics !== false,
      eventBus: config.eventBus
    };
    
    this.eventBus = this.config.eventBus;
  }
  
  /**
   * 提交异步操作
   * @param type 操作类型
   * @param operation 操作函数
   * @param options 操作选项
   * @returns Promise<操作结果>
   */
  async submit<T>(
    type: string,
    operation: () => Promise<T>,
    options: {
      priority?: number;
      context?: any;
      timeout?: number;
    } = {}
  ): Promise<T> {
    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueLength) {
      if (this.config.queueFullBehavior === 'reject') {
        throw new Error(`操作队列已满(${this.config.maxQueueLength})`);
      } else {
        // 等待队列空闲
        await this.waitForQueueSpace();
      }
    }
    
    // 创建一个Promise来跟踪操作完成
    return new Promise<T>((resolve, reject) => {
      const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const submitTime = Date.now();
      
      // 创建操作对象
      const asyncOperation: AsyncOperation<T> = {
        id,
        type,
        operation,
        priority: options.priority || 0,
        submitTime,
        context: options.context,
        resolve,
        reject
      };
      
      // 添加到队列
      this.queue.push(asyncOperation);
      
      // 记录操作
      this.operationResults.set(id, {
        id,
        status: 'pending',
        submitTime
      });
      
      // 更新指标
      this.metrics.totalOperations++;
      this.metrics.queueLength = this.queue.length;
      
      // 更新类型统计
      if (!this.metrics.operationsByType[type]) {
        this.metrics.operationsByType[type] = 0;
      }
      this.metrics.operationsByType[type]++;
      
      // 发布提交事件
      this.publishEvent('operation:submitted', { id, type });
      
      // 尝试处理队列
      this.processQueue();
    });
  }
  
  /**
   * 取消操作
   * @param id 操作ID
   * @returns 是否成功取消
   */
  cancel(id: string): boolean {
    // 查找队列中的操作
    const index = this.queue.findIndex(op => op.id === id);
    
    if (index >= 0) {
      // 从队列中移除操作
      const operation = this.queue.splice(index, 1)[0];
      operation.isCancelled = true;
      
      // 拒绝操作Promise
      operation.reject(new Error(`操作被取消: ${id}`));
      
      // 更新操作结果
      this.operationResults.set(id, {
        id,
        status: 'cancelled',
        submitTime: operation.submitTime,
        completeTime: Date.now()
      });
      
      // 更新指标
      this.metrics.cancelledOperations++;
      this.metrics.queueLength = this.queue.length;
      
      // 发布取消事件
      this.publishEvent('operation:cancelled', { id, type: operation.type });
      
      // 可能有在等待队列空间的操作
      this.notifyWaitingOperations();
      
      return true;
    }
    
    // 可能操作已经在执行，我们无法取消正在执行的操作
    return false;
  }
  
  /**
   * 获取操作状态
   * @param id 操作ID
   * @returns 操作结果
   */
  getOperationStatus(id: string): AsyncOperationResult<any> | undefined {
    return this.operationResults.get(id);
  }
  
  /**
   * 获取异步执行器指标
   * @returns 指标数据
   */
  getMetrics(): AsyncExecutorMetrics {
    // 计算实时吞吐量
    const now = Date.now();
    const lastMinuteTimestamp = now - 60000; // 过去一分钟
    
    // 计算最近一分钟完成的操作数
    const recentCompletions = this.completedTimestamps.filter(
      timestamp => timestamp > lastMinuteTimestamp
    ).length;
    
    // 计算吞吐量(每秒操作数)
    this.metrics.throughput = recentCompletions / 60;
    
    // 更新实时指标
    this.metrics.queueLength = this.queue.length;
    this.metrics.activeOperations = this.activeOperations.size;
    
    return { ...this.metrics };
  }
  
  /**
   * 重置执行器
   */
  reset(): void {
    // 取消所有待处理操作
    for (const operation of this.queue) {
      operation.reject(new Error(`执行器重置，操作被取消: ${operation.id}`));
      
      // 更新操作结果
      this.operationResults.set(operation.id, {
        id: operation.id,
        status: 'cancelled',
        submitTime: operation.submitTime,
        completeTime: Date.now()
      });
      
      // 发布取消事件
      this.publishEvent('operation:cancelled', { 
        id: operation.id, 
        type: operation.type 
      });
    }
    
    // 清空队列
    this.queue = [];
    
    // 不能清空activeOperations，因为它们正在执行
    // 只能重置性能指标
    this.metrics = {
      totalOperations: this.activeOperations.size,
      completedOperations: 0,
      failedOperations: 0,
      cancelledOperations: 0,
      queueLength: 0,
      activeOperations: this.activeOperations.size,
      averageExecutionTimeMs: 0,
      minExecutionTimeMs: Infinity,
      maxExecutionTimeMs: 0,
      averageWaitTimeMs: 0,
      operationsByType: {},
      throughput: 0,
      startTime: Date.now()
    };
    
    this.executionTimes = [];
    this.waitTimes = [];
    this.completedTimestamps = [];
    
    // 通知所有等待队列空间的操作
    this.notifyWaitingOperations();
  }
  
  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    // 如果已经在处理队列，则不再处理
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 循环处理队列，直到队列为空或达到最大并发
      while (
        this.queue.length > 0 && 
        this.activeOperations.size < this.config.maxConcurrency
      ) {
        // 按优先级和提交时间排序
        this.queue.sort((a, b) => {
          const priorityDiff = b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.submitTime - b.submitTime;
        });
        
        // 获取下一个操作
        const operation = this.queue.shift()!;
        
        // 更新队列长度
        this.metrics.queueLength = this.queue.length;
        
        // 如果操作已被取消，继续处理下一个
        if (operation.isCancelled) {
          continue;
        }
        
        // 添加到活跃操作集合
        this.activeOperations.add(operation.id);
        this.metrics.activeOperations = this.activeOperations.size;
        
        // 更新操作状态
        operation.startTime = Date.now();
        
        // 计算等待时间
        const waitTime = operation.startTime - operation.submitTime;
        this.waitTimes.push(waitTime);
        
        // 更新操作结果
        this.operationResults.set(operation.id, {
          id: operation.id,
          status: 'running',
          submitTime: operation.submitTime,
          startTime: operation.startTime,
          waitTimeMs: waitTime
        });
        
        // 发布操作开始事件
        this.publishEvent('operation:started', { 
          id: operation.id, 
          type: operation.type 
        });
        
        // 使用Promise.race处理超时
        // 不等待操作完成，异步执行
        this.executeWithTimeout(operation).catch(error => {
          console.error(`异步操作执行出错: ${operation.id}`, error);
        });
      }
      
      // 如果队列不满，可以通知等待的操作
      if (this.queue.length < this.config.maxQueueLength) {
        this.notifyWaitingOperations();
      }
    } finally {
      this.isProcessing = false;
      
      // 如果还有操作在队列中，且没有达到最大并发，继续处理
      if (
        this.queue.length > 0 && 
        this.activeOperations.size < this.config.maxConcurrency
      ) {
        // 使用setImmediate避免调用堆栈过深
        setImmediate(() => this.processQueue());
      }
    }
  }
  
  /**
   * 执行操作（带超时）
   * @param operation 操作
   */
  private async executeWithTimeout(operation: AsyncOperation<any>): Promise<void> {
    const timeout = operation.context?.timeout || this.config.operationTimeoutMs;
    
    try {
      // 使用Promise.race处理操作超时
      const result = await Promise.race([
        operation.operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`操作超时(${timeout}ms): ${operation.id}`));
          }, timeout);
        })
      ]);
      
      // 操作成功完成
      const completeTime = Date.now();
      const executionTime = completeTime - (operation.startTime || operation.submitTime);
      
      // 收集性能数据
      this.executionTimes.push(executionTime);
      this.completedTimestamps.push(completeTime);
      
      // 限制历史记录大小
      if (this.executionTimes.length > 1000) {
        this.executionTimes.shift();
      }
      if (this.completedTimestamps.length > 1000) {
        this.completedTimestamps.shift();
      }
      
      // 更新指标
      this.metrics.completedOperations++;
      this.metrics.averageExecutionTimeMs = 
        this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
      this.metrics.minExecutionTimeMs = Math.min(
        this.metrics.minExecutionTimeMs, 
        executionTime
      );
      this.metrics.maxExecutionTimeMs = Math.max(
        this.metrics.maxExecutionTimeMs, 
        executionTime
      );
      
      // 更新操作结果
      this.operationResults.set(operation.id, {
        id: operation.id,
        status: 'completed',
        result,
        submitTime: operation.submitTime,
        startTime: operation.startTime,
        completeTime,
        waitTimeMs: (operation.startTime || completeTime) - operation.submitTime,
        executionTimeMs: executionTime
      });
      
      // 解析操作Promise
      operation.resolve(result);
      
      // 发布操作完成事件
      this.publishEvent('operation:completed', {
        id: operation.id,
        type: operation.type,
        duration: executionTime
      });
    } catch (error) {
      // 操作失败
      const completeTime = Date.now();
      const executionTime = completeTime - (operation.startTime || operation.submitTime);
      
      // 更新指标
      this.metrics.failedOperations++;
      
      // 更新操作结果
      this.operationResults.set(operation.id, {
        id: operation.id,
        status: 'failed',
        error: error as Error,
        submitTime: operation.submitTime,
        startTime: operation.startTime,
        completeTime,
        waitTimeMs: (operation.startTime || completeTime) - operation.submitTime,
        executionTimeMs: executionTime
      });
      
      // 拒绝操作Promise
      operation.reject(error as Error);
      
      // 发布操作失败事件
      this.publishEvent('operation:failed', {
        id: operation.id,
        type: operation.type,
        error: error as Error
      });
    } finally {
      // 从活跃操作中移除
      this.activeOperations.delete(operation.id);
      this.metrics.activeOperations = this.activeOperations.size;
      
      // 发布指标更新事件
      if (this.config.enableMetrics) {
        this.publishEvent('metrics:updated', { metrics: this.getMetrics() });
      }
      
      // 可能有更多操作可以开始
      this.processQueue();
    }
  }
  
  /**
   * 等待队列空间
   * @returns Promise，当队列有空间时解析
   */
  private waitForQueueSpace(): Promise<void> {
    return new Promise<void>(resolve => {
      this.waitingResolvers.push(resolve);
    });
  }
  
  /**
   * 通知等待操作
   */
  private notifyWaitingOperations(): void {
    // 唤醒等待的操作
    while (
      this.waitingResolvers.length > 0 && 
      this.queue.length < this.config.maxQueueLength
    ) {
      const resolve = this.waitingResolvers.shift();
      if (resolve) {
        resolve();
      }
    }
  }
  
  /**
   * 发布事件
   * @param event 事件名称
   * @param payload 事件数据
   */
  private publishEvent<K extends keyof AsyncExecutorEvents>(
    event: K,
    payload: AsyncExecutorEvents[K]
  ): void {
    if (this.eventBus) {
      this.eventBus.publish(event, payload);
    }
  }
} 