import { EventBus } from '../eventbus';
import { RuntimeResource } from '../../types';

/**
 * 任务优先级枚举
 */
export enum TaskPriority {
  /** 低优先级任务 */
  Low = 0,
  
  /** 普通优先级任务 */
  Normal = 1,
  
  /** 高优先级任务 */
  High = 2,
  
  /** 紧急优先级任务 */
  Critical = 3
}

/**
 * 调度任务项接口
 */
export interface ScheduledTask<T = any> {
  /** 任务ID */
  id: string;
  
  /** 任务优先级 */
  priority: TaskPriority;
  
  /** 任务资源 */
  resource: RuntimeResource;
  
  /** 任务类型 */
  type: string;
  
  /** 任务处理函数 */
  handler: () => Promise<T>;
  
  /** 任务超时时间(毫秒) */
  timeoutMs?: number;
  
  /** 提交时间 */
  submittedAt: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 当前尝试次数 */
  attempts: number;
  
  /** 分组键，用于同类型任务的并发限制 */
  groupKey?: string;
  
  /** 标签 */
  labels?: Record<string, string>;
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 调度配置接口
 */
export interface SchedulerConfig {
  /** 全局最大并发任务数 */
  maxConcurrentTasks?: number;
  
  /** 每个资源类型的最大并发任务数 */
  resourceTypeConcurrencyLimits?: Record<string, number>;
  
  /** 每个任务组的最大并发任务数 */
  groupConcurrencyLimits?: Record<string, number>;
  
  /** 默认任务超时时间(毫秒) */
  defaultTaskTimeoutMs?: number;
  
  /** 默认最大重试次数 */
  defaultMaxRetries?: number;
  
  /** 是否启用自动重试 */
  enableRetry?: boolean;
  
  /** 空闲检查间隔(毫秒) */
  idleCheckIntervalMs?: number;
  
  /** 最大队列长度 */
  maxQueueLength?: number;
}

/**
 * 任务完成结果接口
 */
export interface TaskResult<T = any> {
  /** 任务ID */
  taskId: string;
  
  /** 任务是否成功 */
  success: boolean;
  
  /** 任务结果数据 */
  data?: T;
  
  /** 任务错误 */
  error?: Error;
  
  /** 执行时间(毫秒) */
  executionTimeMs: number;
  
  /** 等待时间(毫秒) */
  waitTimeMs: number;
  
  /** 尝试次数 */
  attempts: number;
  
  /** 资源ID */
  resourceId: string;
  
  /** 任务类型 */
  taskType: string;
}

export interface SchedulerEvents {
  taskSubmitted: { taskId: string };
  taskCompleted: { taskId: string };
  taskFailed: { taskId: string; error: Error };
  taskRetrying: { taskId: string; retryCount: number };
  taskCancelled: { taskId: string };
}

export interface Task {
  id: string;
  priority: number;
  resourceType?: string;
  groupId?: string;
  execute: () => Promise<any>;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface TaskStatus {
  id: string;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: Error;
  startTime?: number;
  endTime?: number;
  retryCount: number;
}

/**
 * 资源调度器类
 * 负责管理资源执行的优先级、并发控制和资源限制
 */
export class ResourceScheduler {
  /** 事件总线 */
  private eventBus: EventBus<SchedulerEvents>;
  
  /** 调度配置 */
  private config: Required<SchedulerConfig>;
  
  /** 任务队列 - 优先级队列实现 */
  private taskQueue: ScheduledTask[] = [];
  
  /** 正在执行的任务映射 */
  private runningTasks: Map<string, ScheduledTask> = new Map();
  
  /** 资源类型并发计数 */
  private resourceTypeConcurrency: Map<string, number> = new Map();
  
  /** 组并发计数 */
  private groupConcurrency: Map<string, number> = new Map();
  
  /** 调度器是否正在运行 */
  private isRunning: boolean = false;
  
  /** 空闲检查定时器 */
  private idleCheckTimer?: NodeJS.Timeout;
  
  /** 等待执行的Promise解析器 */
  private waitingResolvers: Map<string, (result: TaskResult) => void> = new Map();
  
  /** 最后任务ID */
  private lastTaskId: number = 0;
  
  /**
   * 构造函数
   * @param eventBus 事件总线
   * @param config 调度配置
   */
  constructor(eventBus?: EventBus<SchedulerEvents>, config: SchedulerConfig = {}) {
    this.eventBus = eventBus ?? new EventBus<SchedulerEvents>();
    
    // 设置默认配置
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      resourceTypeConcurrencyLimits: config.resourceTypeConcurrencyLimits || {},
      groupConcurrencyLimits: config.groupConcurrencyLimits || {},
      defaultTaskTimeoutMs: config.defaultTaskTimeoutMs || 60000, // 默认60秒
      defaultMaxRetries: config.defaultMaxRetries || 3,
      enableRetry: config.enableRetry !== undefined ? config.enableRetry : true,
      idleCheckIntervalMs: config.idleCheckIntervalMs || 1000,  // 默认1秒
      maxQueueLength: config.maxQueueLength || 1000
    };
  }
  
  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 开始定期检查空闲资源
    this.idleCheckTimer = setInterval(() => {
      this.processQueue();
    }, this.config.idleCheckIntervalMs);
    
    this.eventBus.publish('scheduler.started', { timestamp: Date.now() });
  }
  
  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // 清除定时器
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = undefined;
    }
    
    this.eventBus.publish('scheduler.stopped', { timestamp: Date.now() });
  }
  
  /**
   * 提交任务
   * @param task 要提交的任务
   * @returns Promise，解析为任务结果
   */
  async scheduleTask<T = any>(task: Omit<ScheduledTask, 'id' | 'submittedAt' | 'attempts'>): Promise<TaskResult<T>> {
    // 检查队列是否已满
    if (this.taskQueue.length >= this.config.maxQueueLength!) {
      throw new Error(`Task queue is full (max: ${this.config.maxQueueLength})`);
    }
    
    // 创建完整的任务对象
    const fullTask: ScheduledTask = {
      ...task,
      id: this.generateTaskId(),
      submittedAt: Date.now(),
      attempts: 0,
      timeoutMs: task.timeoutMs || this.config.defaultTaskTimeoutMs,
      maxRetries: task.maxRetries !== undefined ? task.maxRetries : this.config.defaultMaxRetries
    };
    
    // 将任务添加到队列
    this.enqueueTask(fullTask);
    
    // 发布任务提交事件
    this.eventBus.publish('scheduler.task.submitted', {
      taskId: fullTask.id,
      resourceId: this.getResourceId(fullTask.resource),
      resourceKind: fullTask.resource.kind,
      taskType: fullTask.type,
      priority: fullTask.priority,
      timestamp: Date.now()
    });
    
    // 尝试立即处理队列
    this.processQueue();
    
    // 创建Promise，等待任务完成
    return new Promise<TaskResult<T>>((resolve) => {
      this.waitingResolvers.set(fullTask.id, resolve as (result: TaskResult) => void);
    });
  }
  
  /**
   * 取消任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelTask(taskId: string): boolean {
    // 检查任务是否在队列中
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex >= 0) {
      // 从队列中移除任务
      const task = this.taskQueue[queueIndex];
      this.taskQueue.splice(queueIndex, 1);
      
      // 解析等待的Promise
      const resolver = this.waitingResolvers.get(taskId);
      if (resolver) {
        resolver({
          taskId,
          success: false,
          error: new Error('Task cancelled'),
          executionTimeMs: 0,
          waitTimeMs: Date.now() - task.submittedAt,
          attempts: task.attempts,
          resourceId: this.getResourceId(task.resource),
          taskType: task.type
        });
        this.waitingResolvers.delete(taskId);
      }
      
      // 发布任务取消事件
      this.eventBus.publish('scheduler.task.cancelled', {
        taskId,
        resourceId: this.getResourceId(task.resource),
        resourceKind: task.resource.kind,
        taskType: task.type,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    // 检查任务是否正在执行
    if (this.runningTasks.has(taskId)) {
      // 目前不支持取消正在执行的任务
      // 将来可以实现取消机制，例如通过AbortController
      return false;
    }
    
    return false;
  }
  
  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务状态
   */
  getTaskStatus(taskId: string): 'queued' | 'running' | 'not_found' {
    if (this.taskQueue.some(t => t.id === taskId)) {
      return 'queued';
    }
    
    if (this.runningTasks.has(taskId)) {
      return 'running';
    }
    
    return 'not_found';
  }
  
  /**
   * 获取调度器统计信息
   */
  getStats(): {
    queuedTasksCount: number;
    runningTasksCount: number;
    taskTypeStats: Record<string, number>;
    resourceTypeStats: Record<string, number>;
    priorityStats: Record<TaskPriority, number>;
  } {
    // 初始化任务类型统计
    const taskTypeStats: Record<string, number> = {};
    
    // 初始化资源类型统计
    const resourceTypeStats: Record<string, number> = {};
    
    // 初始化优先级统计
    const priorityStats: Record<TaskPriority, number> = {
      [TaskPriority.Low]: 0,
      [TaskPriority.Normal]: 0,
      [TaskPriority.High]: 0,
      [TaskPriority.Critical]: 0
    };
    
    // 统计队列中的任务
    for (const task of this.taskQueue) {
      taskTypeStats[task.type] = (taskTypeStats[task.type] || 0) + 1;
      resourceTypeStats[task.resource.kind] = (resourceTypeStats[task.resource.kind] || 0) + 1;
      priorityStats[task.priority]++;
    }
    
    // 统计正在运行的任务
    for (const task of this.runningTasks.values()) {
      taskTypeStats[task.type] = (taskTypeStats[task.type] || 0) + 1;
      resourceTypeStats[task.resource.kind] = (resourceTypeStats[task.resource.kind] || 0) + 1;
      priorityStats[task.priority]++;
    }
    
    return {
      queuedTasksCount: this.taskQueue.length,
      runningTasksCount: this.runningTasks.size,
      taskTypeStats,
      resourceTypeStats,
      priorityStats
    };
  }
  
  /**
   * 变更调度器配置
   * @param config 新配置
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // 发布配置更新事件
    this.eventBus.publish('scheduler.config.updated', {
      config: this.config,
      timestamp: Date.now()
    });
    
    // 配置更新后尝试处理队列
    this.processQueue();
  }
  
  /**
   * 将任务添加到队列
   * @param task 任务
   */
  private enqueueTask(task: ScheduledTask): void {
    // 添加任务到队列
    this.taskQueue.push(task);
    
    // 对队列进行排序，按优先级降序
    this.taskQueue.sort((a, b) => {
      // 首先按优先级排序
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      // 优先级相同时，按提交时间排序
      return a.submittedAt - b.submittedAt;
    });
  }
  
  /**
   * 处理队列中的任务
   */
  private processQueue(): void {
    if (!this.isRunning) return;
    
    // 检查是否有空闲容量
    while (this.canRunMoreTasks() && this.taskQueue.length > 0) {
      // 找到下一个可以执行的任务
      const nextTaskIndex = this.findNextExecutableTaskIndex();
      if (nextTaskIndex === -1) break;
      
      // 从队列中移除任务
      const task = this.taskQueue.splice(nextTaskIndex, 1)[0];
      
      // 执行任务
      this.executeTask(task);
    }
  }
  
  /**
   * 查找下一个可执行的任务索引
   */
  private findNextExecutableTaskIndex(): number {
    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];
      
      // 检查资源类型并发限制
      const resourceKind = task.resource.kind;
      const resourceTypeConcurrencyLimit = this.config.resourceTypeConcurrencyLimits![resourceKind] || Number.MAX_SAFE_INTEGER;
      const currentResourceTypeConcurrency = this.resourceTypeConcurrency.get(resourceKind) || 0;
      
      if (currentResourceTypeConcurrency >= resourceTypeConcurrencyLimit) {
        continue;
      }
      
      // 检查组并发限制
      if (task.groupKey) {
        const groupConcurrencyLimit = this.config.groupConcurrencyLimits![task.groupKey] || Number.MAX_SAFE_INTEGER;
        const currentGroupConcurrency = this.groupConcurrency.get(task.groupKey) || 0;
        
        if (currentGroupConcurrency >= groupConcurrencyLimit) {
          continue;
        }
      }
      
      // 找到可执行的任务
      return i;
    }
    
    return -1;
  }
  
  /**
   * 检查是否可以运行更多任务
   */
  private canRunMoreTasks(): boolean {
    return this.runningTasks.size < this.config.maxConcurrentTasks;
  }
  
  /**
   * 执行任务
   * @param task 要执行的任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    // 更新任务尝试次数
    task.attempts++;
    
    // 添加到正在运行的任务
    this.runningTasks.set(task.id, task);
    
    // 更新资源类型并发计数
    const resourceKind = task.resource.kind;
    this.resourceTypeConcurrency.set(
      resourceKind, 
      (this.resourceTypeConcurrency.get(resourceKind) || 0) + 1
    );
    
    // 更新组并发计数
    if (task.groupKey) {
      this.groupConcurrency.set(
        task.groupKey,
        (this.groupConcurrency.get(task.groupKey) || 0) + 1
      );
    }
    
    // 发布任务开始事件
    this.eventBus.publish('scheduler.task.started', {
      taskId: task.id,
      resourceId: this.getResourceId(task.resource),
      resourceKind: task.resource.kind,
      taskType: task.type,
      attempt: task.attempts,
      waitTimeMs: Date.now() - task.submittedAt,
      timestamp: Date.now()
    });
    
    // 执行开始时间
    const startTime = Date.now();
    let success = false;
    let result = undefined;
    let error = undefined;
    
    try {
      // 创建超时定时器和清除函数
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`));
        }, task.timeoutMs);
      });
      
      // 定义清除超时的函数
      const clearTimeoutFn = () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      // 使用Promise.race来处理超时
      result = await Promise.race([
        task.handler(),
        timeoutPromise
      ]);
      
      // 清除超时定时器
      clearTimeoutFn();
      
      success = true;
    } catch (err) {
      error = err as Error;
      success = false;
    }
    
    // 计算执行时间
    const executionTimeMs = Date.now() - startTime;
    
    // 从正在运行的任务中移除
    this.runningTasks.delete(task.id);
    
    // 更新资源类型并发计数
    this.resourceTypeConcurrency.set(
      resourceKind,
      Math.max(0, (this.resourceTypeConcurrency.get(resourceKind) || 0) - 1)
    );
    
    // 更新组并发计数
    if (task.groupKey) {
      this.groupConcurrency.set(
        task.groupKey,
        Math.max(0, (this.groupConcurrency.get(task.groupKey) || 0) - 1)
      );
    }
    
    // 创建任务结果
    const taskResult: TaskResult = {
      taskId: task.id,
      success,
      data: result,
      error,
      executionTimeMs,
      waitTimeMs: startTime - task.submittedAt,
      attempts: task.attempts,
      resourceId: this.getResourceId(task.resource),
      taskType: task.type
    };
    
    if (success) {
      // 发布任务成功事件
      this.eventBus.publish('scheduler.task.completed', {
        ...taskResult,
        timestamp: Date.now()
      });
      
      // 解析等待的Promise
      const resolver = this.waitingResolvers.get(task.id);
      if (resolver) {
        resolver(taskResult);
        this.waitingResolvers.delete(task.id);
      }
    } else {
      // 发布任务失败事件
      this.eventBus.publish('scheduler.task.failed', {
        ...taskResult,
        timestamp: Date.now()
      });
      
      // 检查是否需要重试
      const shouldRetry = this.shouldRetryTask(task, error!);
      
      if (shouldRetry) {
        // 计算重试延迟
        const retryDelayMs = this.calculateRetryDelay(task);
        
        // 发布任务重试事件
        this.eventBus.publish('scheduler.task.retry', {
          taskId: task.id,
          resourceId: this.getResourceId(task.resource),
          resourceKind: task.resource.kind,
          taskType: task.type,
          attempt: task.attempts,
          retryDelayMs,
          error: error!.message,
          timestamp: Date.now()
        });
        
        // 延迟重新入队
        setTimeout(() => {
          // 重置尝试次数，让executeTask增加
          task.attempts = task.attempts;
          this.enqueueTask(task);
          this.processQueue();
        }, retryDelayMs);
      } else {
        // 不再重试，解析等待的Promise
        const resolver = this.waitingResolvers.get(task.id);
        if (resolver) {
          resolver(taskResult);
          this.waitingResolvers.delete(task.id);
        }
      }
    }
    
    // 继续处理队列
    this.processQueue();
  }
  
  /**
   * 判断是否应该重试任务
   * @param task 任务
   * @param error 错误
   */
  private shouldRetryTask(task: ScheduledTask, error: Error): boolean {
    // 检查是否启用自动重试
    if (!this.config.enableRetry) return false;
    
    // 检查最大重试次数
    if (task.attempts >= (task.maxRetries || 0)) return false;
    
    // 检查错误是否可重试
    const isRetryableError = this.isRetryableError(error);
    
    return isRetryableError;
  }
  
  /**
   * 判断错误是否可重试
   * @param error 错误对象
   */
  private isRetryableError(error: Error): boolean {
    // 可以重试的错误类型
    const retryableErrors = [
      'ETIMEOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NETWORK_ERROR',
      'RESOURCE_BUSY',
      'CONFLICT'
    ];
    
    // 查看错误消息中是否包含可重试的关键字
    for (const errType of retryableErrors) {
      if (error.message.includes(errType)) {
        return true;
      }
    }
    
    // 检查错误类型，如果是自定义的可重试错误，返回true
    const customError = error as any;
    if (customError.isRetryable === true) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 计算重试延迟
   * @param task 任务
   */
  private calculateRetryDelay(task: ScheduledTask): number {
    // 基础延迟时间（毫秒）
    const baseDelayMs = 1000;
    
    // 最大延迟时间（毫秒）
    const maxDelayMs = 30000;
    
    // 指数增长：baseDelay * 2^attempt
    const exponentialDelay = baseDelayMs * Math.pow(2, task.attempts - 1);
    
    // 添加最多25%的随机抖动，避免多个失败的请求同时重试
    const jitter = Math.random() * 0.25 * exponentialDelay;
    
    // 应用最大延迟限制
    return Math.min(exponentialDelay + jitter, maxDelayMs);
  }
  
  /**
   * 生成唯一任务ID
   */
  private generateTaskId(): string {
    this.lastTaskId++;
    return `task-${Date.now()}-${this.lastTaskId}`;
  }
  
  /**
   * 获取资源ID
   * @param resource 资源对象
   */
  private getResourceId(resource: RuntimeResource): string {
    return `${resource.metadata.namespace || 'default'}.${resource.metadata.name}`;
  }
} 