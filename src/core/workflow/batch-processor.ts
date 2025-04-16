import { EventBus } from '../eventbus';

/**
 * 批处理配置项
 */
export interface BatchProcessorConfig {
  /** 最大批处理大小 */
  maxBatchSize?: number;
  
  /** 最大等待时间(毫秒) */
  maxWaitTimeMs?: number;
  
  /** 处理超时时间(毫秒) */
  processingTimeoutMs?: number;
  
  /** 并发处理批次数 */
  concurrentBatches?: number;
  
  /** 是否在收集到一批后自动处理 */
  autoProcess?: boolean;
  
  /** 启用性能指标收集 */
  enableMetrics?: boolean;
  
  /** 事件总线 */
  eventBus?: EventBus;
}

/**
 * 批处理项
 */
export interface BatchItem<T, R> {
  /** 项ID */
  id: string;
  
  /** 输入数据 */
  input: T;
  
  /** 提交时间 */
  submittedAt: number;
  
  /** 处理完成回调 */
  resolve: (result: R) => void;
  
  /** 处理错误回调 */
  reject: (error: Error) => void;
  
  /** 处理开始时间 */
  processingStartTime?: number;
  
  /** 处理结束时间 */
  processingEndTime?: number;
  
  /** 分组键 */
  groupKey?: string;
  
  /** 优先级 */
  priority?: number;
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 批处理器事件类型
 */
export interface BatchProcessorEvents {
  'batch:created': { batchId: string, size: number };
  'batch:processing': { batchId: string, size: number };
  'batch:processed': { batchId: string, size: number, timeMs: number };
  'batch:error': { batchId: string, error: Error };
  'item:added': { itemId: string, batchId?: string };
  'item:processed': { itemId: string, timeMs: number };
  'item:error': { itemId: string, error: Error };
  'metrics:updated': { metrics: BatchMetrics };
}

/**
 * 批处理指标
 */
export interface BatchMetrics {
  /** 总处理项数 */
  totalItems: number;
  
  /** 总批次数 */
  totalBatches: number;
  
  /** 当前队列长度 */
  queueLength: number;
  
  /** 正在处理的批次数 */
  processingBatches: number;
  
  /** 平均批处理大小 */
  averageBatchSize: number;
  
  /** 平均处理时间(毫秒) */
  averageProcessingTimeMs: number;
  
  /** 最大处理时间(毫秒) */
  maxProcessingTimeMs: number;
  
  /** 最小处理时间(毫秒) */
  minProcessingTimeMs: number;
  
  /** 成功处理项计数 */
  successCount: number;
  
  /** 失败处理项计数 */
  failureCount: number;
  
  /** 总处理时间(毫秒) */
  totalProcessingTimeMs: number;
  
  /** 平均等待时间(毫秒) */
  averageWaitTimeMs: number;
  
  /** 总等待时间(毫秒) */
  totalWaitTimeMs: number;
  
  /** 处理吞吐率(每秒项数) */
  throughputItemsPerSecond: number;
  
  /** 等待中的项计数 */
  waitingItems: number;
}

/**
 * 批处理器
 * 用于优化性能的批处理操作
 */
export class BatchProcessor<T, R> {
  private queue: BatchItem<T, R>[] = [];
  private processingBatches: Set<string> = new Set();
  private config: Required<BatchProcessorConfig>;
  private processBatchTimer?: NodeJS.Timeout;
  private eventBus?: EventBus;
  private isProcessing: boolean = false;
  private nextBatchId: number = 1;
  
  // 指标收集
  private metrics: BatchMetrics = {
    totalItems: 0,
    totalBatches: 0,
    queueLength: 0,
    processingBatches: 0,
    averageBatchSize: 0,
    averageProcessingTimeMs: 0,
    maxProcessingTimeMs: 0,
    minProcessingTimeMs: Infinity,
    successCount: 0,
    failureCount: 0,
    totalProcessingTimeMs: 0,
    averageWaitTimeMs: 0,
    totalWaitTimeMs: 0,
    throughputItemsPerSecond: 0,
    waitingItems: 0
  };
  
  // 性能数据收集
  private batchSizes: number[] = [];
  private processingTimes: number[] = [];
  private waitTimes: number[] = [];
  private startTime: number = Date.now();
  
  /**
   * 创建批处理器
   * @param processor 批处理函数
   * @param config 配置
   */
  constructor(
    private processor: (items: BatchItem<T, R>[]) => Promise<Record<string, R>>,
    config: BatchProcessorConfig = {}
  ) {
    // 设置默认配置
    this.config = {
      maxBatchSize: config.maxBatchSize || 10,
      maxWaitTimeMs: config.maxWaitTimeMs || 500,
      processingTimeoutMs: config.processingTimeoutMs || 30000,
      concurrentBatches: config.concurrentBatches || 1,
      autoProcess: config.autoProcess !== false,
      enableMetrics: config.enableMetrics !== false,
      eventBus: config.eventBus
    };
    
    this.eventBus = this.config.eventBus;
    
    // 如果启用自动处理，设置定时器
    if (this.config.autoProcess) {
      this.scheduleProcessing();
    }
  }
  
  /**
   * 添加项到批处理队列
   * @param input 输入数据
   * @param options 选项
   * @returns 处理结果Promise
   */
  async add(input: T, options: { 
    priority?: number, 
    groupKey?: string,
    metadata?: Record<string, any>
  } = {}): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const itemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item: BatchItem<T, R> = {
        id: itemId,
        input,
        submittedAt: Date.now(),
        resolve,
        reject,
        groupKey: options.groupKey,
        priority: options.priority || 0,
        metadata: options.metadata
      };
      
      // 添加到队列
      this.queue.push(item);
      
      // 更新指标
      this.metrics.totalItems++;
      this.metrics.queueLength = this.queue.length;
      this.metrics.waitingItems = this.queue.length;
      
      // 发布事件
      this.publishEvent('item:added', { itemId });
      
      // 如果自动处理并且队列达到最大批量大小，立即处理
      if (this.config.autoProcess && this.queue.length >= this.config.maxBatchSize) {
        this.processNextBatch();
      }
    });
  }
  
  /**
   * 获取当前指标
   * @returns 批处理指标
   */
  getMetrics(): BatchMetrics {
    // 更新实时指标
    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    
    this.metrics.queueLength = this.queue.length;
    this.metrics.processingBatches = this.processingBatches.size;
    this.metrics.waitingItems = this.queue.length;
    
    // 计算吞吐率
    if (elapsedSeconds > 0) {
      this.metrics.throughputItemsPerSecond = this.metrics.successCount / elapsedSeconds;
    }
    
    return { ...this.metrics };
  }
  
  /**
   * 手动触发批处理
   */
  processNow(): void {
    this.processNextBatch();
  }
  
  /**
   * 清空队列
   */
  clear(): void {
    // 拒绝所有待处理项
    const error = new Error('批处理器已清空队列');
    for (const item of this.queue) {
      item.reject(error);
      this.publishEvent('item:error', { itemId: item.id, error });
    }
    
    this.queue = [];
    this.metrics.queueLength = 0;
    this.metrics.waitingItems = 0;
  }
  
  /**
   * 关闭批处理器
   */
  shutdown(): void {
    if (this.processBatchTimer) {
      clearTimeout(this.processBatchTimer);
      this.processBatchTimer = undefined;
    }
    
    this.clear();
  }
  
  /**
   * 安排批处理
   */
  private scheduleProcessing(): void {
    if (this.processBatchTimer) {
      clearTimeout(this.processBatchTimer);
    }
    
    this.processBatchTimer = setTimeout(() => {
      this.processNextBatch();
    }, this.config.maxWaitTimeMs);
    
    // 确保定时器不会阻止进程退出
    if (this.processBatchTimer.unref) {
      this.processBatchTimer.unref();
    }
  }
  
  /**
   * 处理下一批
   */
  private async processNextBatch(): Promise<void> {
    // 如果没有项或已经达到最大并发批次，不处理
    if (
      this.queue.length === 0 || 
      this.processingBatches.size >= this.config.concurrentBatches ||
      this.isProcessing
    ) {
      // 如果开启了自动处理，重新调度
      if (this.config.autoProcess) {
        this.scheduleProcessing();
      }
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 获取下一批处理项
      const batchSize = Math.min(this.queue.length, this.config.maxBatchSize);
      
      // 排序队列（按优先级和提交时间）
      this.queue.sort((a, b) => {
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        return priorityDiff !== 0 ? priorityDiff : a.submittedAt - b.submittedAt;
      });
      
      // 获取下一批
      const batch = this.queue.splice(0, batchSize);
      
      // 更新指标
      this.metrics.queueLength = this.queue.length;
      this.metrics.waitingItems = this.queue.length;
      
      // 如果批次为空，跳过处理
      if (batch.length === 0) {
        this.isProcessing = false;
        
        // 如果开启了自动处理，重新调度
        if (this.config.autoProcess) {
          this.scheduleProcessing();
        }
        return;
      }
      
      // 生成批次ID
      const batchId = `batch-${this.nextBatchId++}`;
      this.processingBatches.add(batchId);
      
      // 更新指标
      this.metrics.processingBatches = this.processingBatches.size;
      this.metrics.totalBatches++;
      this.batchSizes.push(batch.length);
      this.metrics.averageBatchSize = this.batchSizes.reduce((a, b) => a + b, 0) / this.batchSizes.length;
      
      // 发布批次创建事件
      this.publishEvent('batch:created', { batchId, size: batch.length });
      
      // 记录开始处理时间
      const batchStartTime = Date.now();
      for (const item of batch) {
        item.processingStartTime = batchStartTime;
        
        // 计算等待时间
        const waitTime = batchStartTime - item.submittedAt;
        this.waitTimes.push(waitTime);
        this.metrics.totalWaitTimeMs += waitTime;
        this.metrics.averageWaitTimeMs = this.metrics.totalWaitTimeMs / this.waitTimes.length;
      }
      
      // 发布批次处理事件
      this.publishEvent('batch:processing', { batchId, size: batch.length });
      
      // 使用超时控制处理批次
      try {
        const results = await this.processWithTimeout(batch, batchId);
        
        // 记录结束处理时间
        const batchEndTime = Date.now();
        const batchProcessingTime = batchEndTime - batchStartTime;
        
        // 更新指标
        this.processingTimes.push(batchProcessingTime);
        this.metrics.totalProcessingTimeMs += batchProcessingTime;
        this.metrics.averageProcessingTimeMs = this.metrics.totalProcessingTimeMs / this.processingTimes.length;
        this.metrics.maxProcessingTimeMs = Math.max(this.metrics.maxProcessingTimeMs, batchProcessingTime);
        this.metrics.minProcessingTimeMs = Math.min(this.metrics.minProcessingTimeMs, batchProcessingTime);
        
        // 响应各个项
        for (const item of batch) {
          item.processingEndTime = batchEndTime;
          const itemResult = results[item.id];
          
          if (itemResult !== undefined) {
            // 成功处理
            item.resolve(itemResult);
            this.metrics.successCount++;
            
            // 计算处理时间
            const itemProcessingTime = batchEndTime - (item.processingStartTime || batchStartTime);
            
            // 发布项处理完成事件
            this.publishEvent('item:processed', { 
              itemId: item.id, 
              timeMs: itemProcessingTime 
            });
          } else {
            // 处理失败
            const error = new Error(`项 ${item.id} 处理结果不存在`);
            item.reject(error);
            this.metrics.failureCount++;
            
            // 发布项错误事件
            this.publishEvent('item:error', { itemId: item.id, error });
          }
        }
        
        // 发布批次处理完成事件
        this.publishEvent('batch:processed', { 
          batchId, 
          size: batch.length,
          timeMs: batchProcessingTime
        });
      } catch (error) {
        // 批处理出错
        for (const item of batch) {
          item.reject(error as Error);
          this.metrics.failureCount++;
          
          // 发布项错误事件
          this.publishEvent('item:error', { itemId: item.id, error: error as Error });
        }
        
        // 发布批次错误事件
        this.publishEvent('batch:error', { batchId, error: error as Error });
      } finally {
        // 从正在处理的批次中移除
        this.processingBatches.delete(batchId);
        this.metrics.processingBatches = this.processingBatches.size;
      }
    } finally {
      this.isProcessing = false;
      
      // 发布更新的指标
      if (this.config.enableMetrics) {
        this.publishEvent('metrics:updated', { metrics: this.getMetrics() });
      }
      
      // 如果队列中还有项且开启了自动处理，继续处理
      if (this.queue.length > 0 && this.config.autoProcess) {
        // 使用setImmediate避免调用堆栈过深
        setImmediate(() => this.processNextBatch());
      } else if (this.config.autoProcess) {
        // 否则，重新调度
        this.scheduleProcessing();
      }
    }
  }
  
  /**
   * 使用超时控制处理批次
   * @param batch 批次
   * @param batchId 批次ID
   * @returns 处理结果
   */
  private async processWithTimeout(
    batch: BatchItem<T, R>[], 
    batchId: string
  ): Promise<Record<string, R>> {
    return Promise.race([
      this.processor(batch),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`批次 ${batchId} 处理超时(${this.config.processingTimeoutMs}ms)`));
        }, this.config.processingTimeoutMs);
      })
    ]);
  }
  
  /**
   * 发布事件
   * @param event 事件名称
   * @param payload 事件数据
   */
  private publishEvent<K extends keyof BatchProcessorEvents>(
    event: K, 
    payload: BatchProcessorEvents[K]
  ): void {
    if (this.eventBus) {
      this.eventBus.publish(event, payload);
    }
  }
} 