import { EventBus } from '../eventbus';
import { RuntimeResource } from '../../types';
import { 
  ResourcePhase, 
  ResourceStatus, 
  ResourceStatusManager,
  ConditionStatus,
  ConditionType,
  StatusTransitionEvent
} from '../state/resource-status';

/**
 * 控制器接口
 * 定义了资源控制器的基本职责和生命周期方法
 */
export interface Controller<T extends RuntimeResource> {
  /**
   * 开始监视资源变化
   * @param resource 可选的资源对象
   */
  watch(resource?: T): void;
  
  /**
   * 调谐资源状态，使实际状态与期望状态一致
   */
  reconcile(resource: T): Promise<void>;
  
  /**
   * 获取资源的期望状态
   */
  getDesiredState(resource: T): Promise<any>;
  
  /**
   * 获取资源的当前状态
   */
  getCurrentState(resource: T): Promise<any>;
  
  /**
   * 清理资源及其关联资源
   */
  cleanupResource(resource: T): Promise<void>;
}

/**
 * 重试策略接口
 * 定义了如何处理重试逻辑
 */
export interface RetryStrategy {
  /**
   * 计算下一次重试的延迟时间
   * @param attempt 当前尝试次数
   * @param error 上一次尝试的错误
   */
  calculateDelay(attempt: number, error: Error): number;
  
  /**
   * 检查是否应该继续重试
   * @param attempt 当前尝试次数
   * @param error 上一次尝试的错误
   */
  shouldRetry(attempt: number, error: Error): boolean;
}

/**
 * 指数退避重试策略
 * 实现了指数增长的重试间隔，以及最大重试次数限制
 */
export class ExponentialBackoffRetry implements RetryStrategy {
  /**
   * 构造函数
   * @param baseDelayMs 基础延迟时间（毫秒）
   * @param maxDelayMs 最大延迟时间（毫秒）
   * @param maxRetries 最大重试次数
   */
  constructor(
    private baseDelayMs: number = 1000,
    private maxDelayMs: number = 30000,
    private maxRetries: number = 5
  ) {}
  
  /**
   * 计算下一次重试的延迟时间
   * 使用指数退避算法，加上一些随机抖动
   */
  calculateDelay(attempt: number, error: Error): number {
    // 指数增长：baseDelay * 2^attempt
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    
    // 添加最多25%的随机抖动，避免多个失败的请求同时重试
    const jitter = Math.random() * 0.25 * exponentialDelay;
    
    // 应用最大延迟限制
    return Math.min(exponentialDelay + jitter, this.maxDelayMs);
  }
  
  /**
   * 检查是否应该继续重试
   * 基于最大重试次数和错误类型判断
   */
  shouldRetry(attempt: number, error: Error): boolean {
    // 超过最大重试次数
    if (attempt >= this.maxRetries) {
      return false;
    }
    
    // 如果是临时错误，可以重试；如果是永久错误，不应重试
    // 这里可以根据错误类型判断是否可以重试
    return this.isRetryableError(error);
  }
  
  /**
   * 判断错误是否可以重试
   * @param error 错误对象
   * @returns 是否可以重试
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
}

/**
 * 资源控制器基类
 * 提供了控制器的通用实现
 */
export abstract class ResourceController<T extends RuntimeResource> implements Controller<T> {
  /** 事件总线 */
  protected eventBus: EventBus;
  
  /** 重试策略 */
  protected retryStrategy: RetryStrategy;
  
  /** 调谐间隔（毫秒） */
  protected reconcileIntervalMs: number = 60000; // 默认1分钟
  
  /** 是否启用自动重试 */
  protected enableRetry: boolean = true;
  
  /** 定时器ID */
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  /** 资源锁，防止并发调谐同一资源 */
  private locks: Set<string> = new Set();
  
  /**
   * 构造函数
   * @param eventBus 事件总线实例
   * @param retryStrategy 可选的重试策略
   */
  constructor(
    eventBus: EventBus,
    retryStrategy?: RetryStrategy
  ) {
    this.eventBus = eventBus;
    this.retryStrategy = retryStrategy || new ExponentialBackoffRetry();
    
    // 订阅全局事件
    this.subscribeToEvents();
  }
  
  /**
   * 获取资源类型
   * 子类需要重写此方法，返回资源类型
   */
  protected abstract getResourceKind(): string;
  
  /**
   * 订阅事件总线上的事件
   */
  private subscribeToEvents(): void {
    const kind = this.getResourceKind().toLowerCase();
    
    // 监听资源创建事件
    this.eventBus.subscribe(`${kind}.created`, (data: any) => {
      const resource = data.resource as T;
      if (resource) {
        this.handleResourceCreated(resource);
      }
    });
    
    // 监听资源更新事件
    this.eventBus.subscribe(`${kind}.updated`, (data: any) => {
      const resource = data.resource as T;
      if (resource) {
        this.handleResourceUpdated(resource);
      }
    });
    
    // 监听资源删除事件
    this.eventBus.subscribe(`${kind}.deleted`, (data: any) => {
      const resource = data.resource as T;
      if (resource) {
        this.handleResourceDeleted(resource);
      }
    });
    
    // 注册控制器
    console.log(`${this.getResourceKind()} controller registered with event bus`);
  }
  
  /**
   * 开始监视资源变化
   * @param resource 可选的资源对象，如果提供将立即协调该资源
   */
  watch(resource?: T): void {
    console.log(`${this.getResourceKind()} controller started watching`);
    
    // 如果提供了资源，立即协调
    if (resource) {
      this.startReconcileLoop(resource);
    }
  }
  
  /**
   * 启动资源的协调循环
   * @param resource 要协调的资源
   */
  protected startReconcileLoop(resource: T): void {
    const resourceId = this.getResourceId(resource);
    
    // 先停止现有的协调循环
    this.stopReconcileLoop(resourceId);
    
    // 立即执行一次协调
    this.reconcile(resource).catch(err => {
      console.error(`Error during initial reconciliation of ${resourceId}:`, err);
    });
    
    // 设置定期协调的定时器
    const timer = setInterval(() => {
      this.reconcile(resource).catch(err => {
        console.error(`Error during periodic reconciliation of ${resourceId}:`, err);
      });
    }, this.reconcileIntervalMs);
    
    // 保存定时器ID
    this.timers.set(resourceId, timer);
    
    console.log(`Started reconcile loop for ${resourceId}`);
  }
  
  /**
   * 停止资源的协调循环
   * @param resourceId 资源ID
   */
  protected stopReconcileLoop(resourceId: string): void {
    const timer = this.timers.get(resourceId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(resourceId);
      console.log(`Stopped reconcile loop for ${resourceId}`);
    }
  }
  
  /**
   * 获取资源ID
   * @param resource 资源对象
   * @returns 资源唯一标识符
   */
  protected getResourceId(resource: T): string {
    return `${resource.metadata.namespace || 'default'}.${resource.metadata.name}`;
  }
  
  /**
   * 协调资源状态
   * 比较期望状态和当前状态，执行必要的操作使它们一致
   * @param resource 要协调的资源
   */
  async reconcile(resource: T): Promise<void> {
    const resourceId = this.getResourceId(resource);
    const resourceKind = this.getResourceKind();
    
    // 检查是否有并发协调，如果有则跳过
    if (this.locks.has(resourceId)) {
      console.log(`Skipping reconciliation of ${resourceId} as it's already in progress`);
      return;
    }
    
    // 添加锁
    this.locks.add(resourceId);
    
    try {
      console.log(`Reconciling ${resourceKind}/${resourceId}`);
      
      // 确保资源有状态字段
      if (!resource.status) {
        resource.status = ResourceStatusManager.createStatus();
      }
      
      // 设置协调中条件
      ResourceStatusManager.setCondition(
        resource.status as ResourceStatus,
        ConditionType.Reconciling,
        ConditionStatus.True,
        'ReconciliationInProgress',
        'Resource reconciliation is in progress'
      );
      
      // 检查资源是否被标记为删除
      if (this.isResourceMarkedForDeletion(resource)) {
        await this.handleResourceDeletion(resource);
        return;
      }
      
      // 验证资源配置
      try {
        this.validateResource(resource);
      } catch (error) {
        await this.handleValidationFailure(resource, error as Error);
        return;
      }
      
      // 解析依赖
      try {
        await this.resolveDependencies(resource);
      } catch (error) {
        await this.handleDependencyResolutionFailure(resource, error as Error);
        return;
      }
      
      // 获取当前状态和期望状态
      let currentState, desiredState;
      try {
        [currentState, desiredState] = await Promise.all([
          this.getCurrentState(resource),
          this.getDesiredState(resource)
        ]);
      } catch (error) {
        await this.handleStateRetrievalFailure(resource, error as Error);
        return;
      }
      
      // 对比状态并执行必要的更新
      try {
        const needsUpdate = this.needsUpdate(currentState, desiredState);
        if (needsUpdate) {
          await this.updateResourceState(resource, desiredState, currentState);
          
          // 发布状态更新事件
          this.eventBus.publish(`${resourceKind.toLowerCase()}.state.updated`, {
            resourceId,
            kind: resourceKind,
            name: resource.metadata.name,
            namespace: resource.metadata.namespace,
            currentState,
            desiredState
          });
        } else {
          console.log(`No state update needed for ${resourceId}`);
        }
      } catch (error) {
        await this.handleUpdateFailure(resource, error as Error);
        return;
      }
      
      // 协调成功，更新状态
      const status = resource.status as ResourceStatus;
      if (status.phase === ResourcePhase.Pending || status.phase === ResourcePhase.Initializing) {
        const event = ResourceStatusManager.updatePhase(
          status,
          ResourcePhase.Running,
          'ReconciliationSucceeded',
          'Resource reconciliation completed successfully'
        );
        
        if (event) {
          this.publishStatusTransitionEvent(resource, event);
        }
      }
      
      // 清除协调中条件
      ResourceStatusManager.setCondition(
        status,
        ConditionType.Reconciling,
        ConditionStatus.False,
        'ReconciliationCompleted',
        'Resource reconciliation completed successfully'
      );
      
      // 发布协调成功事件
      this.eventBus.publish(`${resourceKind.toLowerCase()}.reconciled`, {
        resourceId,
        kind: resourceKind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      });
    } catch (error) {
      // 处理未捕获的错误
      await this.handleReconcileFailure(resource, error as Error);
    } finally {
      // 释放锁
      this.locks.delete(resourceId);
    }
  }
  
  /**
   * 判断资源是否需要更新
   * @param currentState 当前状态
   * @param desiredState 期望状态
   * @returns 是否需要更新
   */
  protected needsUpdate(currentState: any, desiredState: any): boolean {
    // 默认实现使用简单的深度比较
    // 子类可以重写此方法以提供更复杂的比较逻辑
    return JSON.stringify(currentState) !== JSON.stringify(desiredState);
  }
  
  /**
   * 检查资源是否被标记为删除
   * @param resource 资源对象
   * @returns 是否被标记为删除
   */
  protected isResourceMarkedForDeletion(resource: T): boolean {
    // 检查metadata.deletionTimestamp是否存在
    const metadata = resource.metadata as any;
    return !!metadata.deletionTimestamp;
  }
  
  /**
   * 处理资源删除
   * @param resource 要删除的资源
   */
  protected async handleResourceDeletion(resource: T): Promise<void> {
    const resourceId = this.getResourceId(resource);
    const resourceKind = this.getResourceKind();
    
    try {
      // 更新资源状态为Terminating
      const status = resource.status as ResourceStatus;
      const event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Terminating,
        'DeletionInProgress',
        'Resource is being deleted'
      );
      
      if (event) {
        this.publishStatusTransitionEvent(resource, event);
      }
      
      // 执行资源清理
      await this.cleanupResource(resource);
      
      // 停止协调循环
      this.stopReconcileLoop(resourceId);
      
      // 发布删除完成事件
      this.eventBus.publish(`${resourceKind.toLowerCase()}.deleted.completed`, {
        resourceId,
        kind: resourceKind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      });
      
      console.log(`Resource ${resourceId} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete resource ${resourceId}:`, error);
      
      // 更新状态为删除失败
      const status = resource.status as ResourceStatus;
      ResourceStatusManager.setCondition(
        status,
        ConditionType.Terminating,
        ConditionStatus.False,
        'DeletionFailed',
        `Failed to delete resource: ${(error as Error).message}`
      );
      
      // 发布删除失败事件
      this.eventBus.publish(`${resourceKind.toLowerCase()}.deleted.failed`, {
        resourceId,
        kind: resourceKind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace,
        error: (error as Error).message
      });
      
      throw error;
    }
  }
  
  /**
   * 处理资源验证失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleValidationFailure(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    console.error(`Validation failed for ${resourceId}:`, error);
    
    // 更新资源状态为Failed
    const status = resource.status as ResourceStatus;
    const event = ResourceStatusManager.updatePhase(
      status,
      ResourcePhase.Failed,
      'ValidationFailed',
      `Resource validation failed: ${error.message}`
    );
    
    if (event) {
      this.publishStatusTransitionEvent(resource, event);
    }
    
    // 发布验证失败事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.validation.failed`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      error: error.message
    });
  }
  
  /**
   * 处理依赖解析失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleDependencyResolutionFailure(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    console.error(`Dependency resolution failed for ${resourceId}:`, error);
    
    // 更新资源状态为Failed
    const status = resource.status as ResourceStatus;
    const event = ResourceStatusManager.updatePhase(
      status,
      ResourcePhase.Failed,
      'DependencyResolutionFailed',
      `Failed to resolve dependencies: ${error.message}`
    );
    
    if (event) {
      this.publishStatusTransitionEvent(resource, event);
    }
    
    // 发布依赖解析失败事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.dependency.failed`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      error: error.message
    });
  }
  
  /**
   * 处理状态获取失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleStateRetrievalFailure(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    console.error(`State retrieval failed for ${resourceId}:`, error);
    
    // 更新资源状态为Failed或Unknown
    const status = resource.status as ResourceStatus;
    const event = ResourceStatusManager.updatePhase(
      status,
      ResourcePhase.Unknown,
      'StateRetrievalFailed',
      `Failed to retrieve resource state: ${error.message}`
    );
    
    if (event) {
      this.publishStatusTransitionEvent(resource, event);
    }
    
    // 发布状态获取失败事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.state.retrieval.failed`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      error: error.message
    });
  }
  
  /**
   * 处理状态更新失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleUpdateFailure(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    console.error(`State update failed for ${resourceId}:`, error);
    
    // 更新资源状态为Failed或Degraded
    const status = resource.status as ResourceStatus;
    
    // 根据错误类型决定是设为Failed还是Degraded
    const newPhase = this.shouldMarkAsFailed(error) ? 
      ResourcePhase.Failed : ResourcePhase.Degraded;
    
    const event = ResourceStatusManager.updatePhase(
      status,
      newPhase,
      'UpdateFailed',
      `Failed to update resource state: ${error.message}`
    );
    
    if (event) {
      this.publishStatusTransitionEvent(resource, event);
    }
    
    // 尝试进行重试
    if (this.enableRetry && this.retryStrategy.shouldRetry(this.getRetryAttempt(resource), error)) {
      await this.scheduleRetry(resource, error);
    }
    
    // 发布更新失败事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.update.failed`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      error: error.message,
      phase: newPhase
    });
  }
  
  /**
   * 处理协调失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleReconcileFailure(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    console.error(`Reconciliation failed for ${resourceId}:`, error);
    
    // 更新资源状态
    const status = resource.status as ResourceStatus;
    
    // 根据错误类型决定是设为Failed还是Degraded
    const newPhase = this.shouldMarkAsFailed(error) ? 
      ResourcePhase.Failed : ResourcePhase.Degraded;
    
    const event = ResourceStatusManager.updatePhase(
      status,
      newPhase,
      'ReconciliationFailed',
      `Resource reconciliation failed: ${error.message}`
    );
    
    if (event) {
      this.publishStatusTransitionEvent(resource, event);
    }
    
    // 清除协调中条件
    ResourceStatusManager.setCondition(
      status,
      ConditionType.Reconciling,
      ConditionStatus.False,
      'ReconciliationFailed',
      `Reconciliation failed: ${error.message}`
    );
    
    // 尝试进行重试
    if (this.enableRetry && this.retryStrategy.shouldRetry(this.getRetryAttempt(resource), error)) {
      await this.scheduleRetry(resource, error);
    }
    
    // 发布协调失败事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.reconcile.failed`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      error: error.message,
      phase: newPhase
    });
    
    // 如果是关键错误，停止协调循环
    if (this.isCriticalError(error)) {
      this.stopReconcileLoop(resourceId);
    }
  }
  
  /**
   * 判断错误是否为关键错误
   * 关键错误会导致停止协调
   * @param error 错误对象
   */
  protected isCriticalError(error: Error): boolean {
    // 默认实现，子类可以重写
    // 检查错误消息中是否包含关键字
    const criticalKeywords = [
      'FATAL',
      'CRITICAL',
      'UNRECOVERABLE'
    ];
    
    for (const keyword of criticalKeywords) {
      if (error.message.toUpperCase().includes(keyword)) {
        return true;
      }
    }
    
    // 检查自定义错误属性
    const customError = error as any;
    return customError.isCritical === true;
  }
  
  /**
   * 判断错误是否应该将资源标记为失败状态
   * @param error 错误对象
   */
  protected shouldMarkAsFailed(error: Error): boolean {
    // 默认实现，子类可以重写
    // 检查是否是临时错误，如果是则不标记为失败
    if (this.isRetryableError(error)) {
      return false;
    }
    
    // 检查自定义错误属性
    const customError = error as any;
    if (customError.shouldMarkAsFailed === false) {
      return false;
    }
    
    // 默认行为是将资源标记为失败
    return true;
  }
  
  /**
   * 判断错误是否可以重试
   * @param error 错误对象
   */
  protected isRetryableError(error: Error): boolean {
    // 使用重试策略判断
    if (this.retryStrategy instanceof ExponentialBackoffRetry) {
      return (this.retryStrategy as ExponentialBackoffRetry).shouldRetry(1, error);
    }
    
    // 默认实现
    const retryableErrors = [
      'ETIMEOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'RESOURCE_BUSY',
      'TEMPORARY'
    ];
    
    for (const errType of retryableErrors) {
      if (error.message.toUpperCase().includes(errType)) {
        return true;
      }
    }
    
    // 检查自定义错误属性
    const customError = error as any;
    return customError.isRetryable === true;
  }
  
  /**
   * 获取资源的重试次数
   * @param resource 资源对象
   */
  protected getRetryAttempt(resource: T): number {
    const status = resource.status as any;
    return status.retryCount || 0;
  }
  
  /**
   * 增加资源的重试次数
   * @param resource 资源对象
   */
  protected incrementRetryAttempt(resource: T): number {
    const status = resource.status as any;
    const currentCount = status.retryCount || 0;
    status.retryCount = currentCount + 1;
    return status.retryCount;
  }
  
  /**
   * 安排重试协调
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async scheduleRetry(resource: T, error: Error): Promise<void> {
    const resourceId = this.getResourceId(resource);
    
    // 增加重试计数
    const retryCount = this.incrementRetryAttempt(resource);
    
    // 计算重试延迟
    const delayMs = this.retryStrategy.calculateDelay(retryCount, error);
    
    console.log(`Scheduling retry #${retryCount} for ${resourceId} in ${delayMs}ms`);
    
    // 设置重试定时器
    setTimeout(() => {
      // 确保资源锁已释放
      if (this.locks.has(resourceId)) {
        console.log(`Cannot retry ${resourceId} as it's still locked`);
        return;
      }
      
      console.log(`Executing retry #${retryCount} for ${resourceId}`);
      
      // 执行重试
      this.reconcile(resource).catch(retryError => {
        console.error(`Retry #${retryCount} failed for ${resourceId}:`, retryError);
      });
    }, delayMs);
    
    // 更新资源状态，添加重试信息
    const status = resource.status as ResourceStatus;
    if (!status.details) {
      status.details = {};
    }
    
    status.details.lastRetryTime = new Date().toISOString();
    status.details.retryCount = retryCount;
    status.details.nextRetryTime = new Date(Date.now() + delayMs).toISOString();
    
    // 发布重试事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.retry.scheduled`, {
      resourceId,
      kind: this.getResourceKind(),
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
      retryCount,
      delayMs,
      nextRetryTime: status.details.nextRetryTime
    });
  }
  
  /**
   * 处理资源创建事件
   * @param resource 创建的资源
   */
  protected handleResourceCreated(resource: T): void {
    console.log(`Resource ${this.getResourceId(resource)} created`);
    
    // 启动协调循环
    this.startReconcileLoop(resource);
  }
  
  /**
   * 处理资源更新事件
   * @param resource 更新的资源
   */
  protected handleResourceUpdated(resource: T): void {
    console.log(`Resource ${this.getResourceId(resource)} updated`);
    
    // 重新启动协调循环
    this.startReconcileLoop(resource);
  }
  
  /**
   * 处理资源删除事件
   * @param resource 删除的资源
   */
  protected handleResourceDeleted(resource: T): void {
    const resourceId = this.getResourceId(resource);
    console.log(`Resource ${resourceId} deleted`);
    
    // 停止协调循环
    this.stopReconcileLoop(resourceId);
  }
  
  /**
   * 发布状态转换事件
   * @param resource 资源对象
   * @param event 状态转换事件
   */
  protected publishStatusTransitionEvent(resource: T, event: StatusTransitionEvent): void {
    // 补充事件信息
    event.kind = this.getResourceKind();
    event.name = resource.metadata.name;
    event.namespace = resource.metadata.namespace;
    
    // 发布事件
    this.eventBus.publish(`${this.getResourceKind().toLowerCase()}.phase.changed`, event);
  }
  
  /**
   * 验证资源配置
   * @param resource 要验证的资源
   * @throws 如果验证失败，抛出错误
   */
  protected validateResource(resource: T): void {
    // 基本验证
    if (!resource) {
      throw new Error('Resource is null or undefined');
    }
    
    if (!resource.kind) {
      throw new Error('Resource kind is missing');
    }
    
    if (!resource.metadata) {
      throw new Error('Resource metadata is missing');
    }
    
    if (!resource.metadata.name) {
      throw new Error('Resource name is missing');
    }
    
    if (!resource.spec) {
      throw new Error('Resource spec is missing');
    }
    
    // 子类应该重写此方法以实现特定资源类型的验证
  }
  
  /**
   * 解析资源依赖
   * 子类应该重写此方法以实现资源特定的依赖解析
   * @param resource 要解析依赖的资源
   */
  protected async resolveDependencies(resource: T): Promise<void> {
    // 基类提供默认的空实现
    // 子类应该重写此方法以实现资源特定的依赖解析
  }
  
  /**
   * 更新资源状态
   * 执行将资源从当前状态转换到期望状态的操作
   * 子类必须重写此方法以实现资源特定的状态更新逻辑
   * @param resource 要更新的资源
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected abstract updateResourceState(
    resource: T, 
    desiredState: any, 
    currentState: any
  ): Promise<void>;
  
  /**
   * 清理资源及其关联资源
   * 子类应该重写此方法以实现资源特定的清理逻辑
   * @param resource 要清理的资源
   */
  async cleanupResource(resource: T): Promise<void> {
    // 基类提供默认的空实现
    // 子类应该重写此方法以实现资源特定的清理逻辑
    console.log(`Cleaning up resource ${this.getResourceId(resource)}`);
  }
  
  /**
   * 获取资源的期望状态
   * 子类必须重写此方法以定义资源的期望状态
   * @param resource 资源对象
   */
  abstract getDesiredState(resource: T): Promise<any>;
  
  /**
   * 获取资源的当前状态
   * 子类必须重写此方法以获取资源的当前状态
   * @param resource 资源对象
   */
  abstract getCurrentState(resource: T): Promise<any>;
} 