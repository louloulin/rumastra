import { RuntimeResource, Condition } from '../types';
import { EventBus } from '../core/eventbus';

/**
 * 控制器接口
 * 每种资源类型都有一个对应的控制器负责管理资源的生命周期
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
}

/**
 * 通用资源状态类型
 */
interface ResourceStatus {
  phase: string;
  conditions?: Condition[];
  [key: string]: any;
}

/**
 * 资源状态枚举
 */
export enum ResourcePhase {
  Pending = 'Pending',
  Creating = 'Creating',
  Ready = 'Ready',
  Failed = 'Failed',
  Terminating = 'Terminating'
}

/**
 * 控制器基类
 * 提供通用的控制器功能
 */
export abstract class ControllerBase<T extends RuntimeResource> implements Controller<T> {
  constructor(protected readonly kind: string) {}
  
  /**
   * 开始监视资源变化
   * @param resource 可选的资源对象
   */
  watch(resource?: T): void {
    console.log(`Controller for ${this.kind} is now watching for changes`);
    
    // 如果提供了资源，协调该资源
    if (resource) {
      this.reconcile(resource).catch(error => {
        console.error(`Failed to reconcile ${this.kind}/${resource.metadata.name} during watch:`, 
          (error as Error).message);
      });
    }
  }
  
  /**
   * 调谐资源状态
   */
  async reconcile(resource: T): Promise<void> {
    try {
      console.log(`Reconciling ${this.kind}/${resource.metadata.name}`);
      
      // 获取当前状态和期望状态
      const currentState = await this.getCurrentState(resource);
      const desiredState = await this.getDesiredState(resource);
      
      // 检查是否需要更新
      if (JSON.stringify(currentState) !== JSON.stringify(desiredState)) {
        await this.updateState(resource, desiredState);
      }
    } catch (error) {
      console.error(`Failed to reconcile ${this.kind}/${resource.metadata.name}:`, 
        (error as Error).message);
      throw error;
    }
  }
  
  /**
   * 更新资源状态
   */
  protected abstract updateState(resource: T, desiredState: any): Promise<void>;
  
  /**
   * 获取资源的期望状态
   */
  abstract getDesiredState(resource: T): Promise<any>;
  
  /**
   * 获取资源的当前状态
   */
  abstract getCurrentState(resource: T): Promise<any>;
}

/**
 * 抽象控制器类
 * 提供了控制器接口的通用实现
 */
export abstract class AbstractController<T extends RuntimeResource> implements Controller<T> {
  protected eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 监视资源变化
   * @param resource 可选的资源对象
   */
  watch(resource?: T): void {
    // 如果未提供资源，仅初始化控制器，不执行操作
    if (!resource) {
      console.log(`Controller registered for ${this.constructor.name}`);
      return;
    }
    
    // 生成资源ID
    const resourceId = this.getResourceId(resource);
    
    // 处理资源创建或更新
    this.handleResourceCreatedOrUpdated(resource);
    
    // 发布资源监视事件
    this.eventBus.publish(`${resource.kind.toLowerCase()}.watched`, { resource });
    
    // 订阅资源更新事件
    this.eventBus.subscribe(`${resource.kind}.updated.${resourceId}`, (updatedResource: T) => {
      this.handleResourceUpdated(updatedResource);
    });
    
    // 订阅资源删除事件
    this.eventBus.subscribe(`${resource.kind}.deleted.${resourceId}`, () => {
      this.handleResourceDeleted(resource);
    });
  }

  /**
   * 协调资源状态
   * 比较资源的期望状态和当前状态，采取必要的操作
   */
  async reconcile(resource: T): Promise<void> {
    const resourceId = this.getResourceId(resource);
    
    try {
      // 检查资源是否被标记为删除
      const metadataWithDeletion = resource.metadata as { 
        name: string; 
        namespace?: string; 
        labels?: Record<string, string>; 
        annotations?: Record<string, string>;
        deletionTimestamp?: string;
      };
      
      if (metadataWithDeletion.deletionTimestamp) {
        // 资源已被标记为删除，执行清理
        await this.cleanupResource(resource);
        
        // 触发资源清理事件
        this.eventBus.publish(`${resource.kind.toLowerCase()}.deleted`, {
          resourceId,
          kind: resource.kind,
          name: resource.metadata.name,
          namespace: resource.metadata.namespace
        });
        
        return;
      }
      
      // 获取资源期望状态
      const desiredState = await this.getDesiredState(resource);
      
      // 获取资源当前状态
      const currentState = await this.getCurrentState(resource);
      
      // 更新资源状态
      await this.updateResourceState(resource, desiredState, currentState);
      
      // 触发资源协调事件
      this.eventBus.publish(`${resource.kind.toLowerCase()}.reconciled`, {
        resourceId,
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      });
    } catch (error) {
      // 处理协调失败
      await this.handleReconcileFailure(resource, error);
      
      // 触发协调失败事件
      this.eventBus.publish(`${resource.kind.toLowerCase()}.reconcile.failed`, {
        resourceId,
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace,
        error: (error as Error).message
      });
      
      // 重新抛出错误
      throw error;
    }
  }

  /**
   * 获取资源ID
   * @param resource 资源对象
   * @returns 资源ID
   */
  protected getResourceId(resource: T): string {
    return `${resource.metadata.namespace || 'default'}.${resource.metadata.name}`;
  }

  /**
   * 处理资源创建或更新事件
   * @param resource 资源对象
   */
  protected async handleResourceCreatedOrUpdated(resource: T): Promise<void> {
    await this.reconcile(resource);
  }

  /**
   * 处理资源更新事件
   * @param resource 更新后的资源对象
   */
  protected async handleResourceUpdated(resource: T): Promise<void> {
    await this.reconcile(resource);
  }

  /**
   * 处理资源删除事件
   * @param resource 删除的资源对象
   */
  protected async handleResourceDeleted(resource: T): Promise<void> {
    // 执行清理操作
    await this.cleanupResource(resource);
    
    // 发布清理完成事件
    const resourceId = this.getResourceId(resource);
    this.eventBus.publish(`${resource.kind.toLowerCase()}.cleaned`, { 
      resource 
    });
  }

  /**
   * 处理协调失败
   * @param resource 资源对象
   * @param error 错误对象
   */
  protected async handleReconcileFailure(resource: T, error: Error): Promise<void> {
    // 确保状态对象存在
    if (!resource.status) {
      resource.status = {
        phase: 'Failed',
        conditions: []
      } as ResourceStatus;
    } else {
      // 更新资源状态为失败
      const status = resource.status as ResourceStatus;
      status.phase = 'Failed';
      
      // 确保conditions数组存在
      if (!status.conditions) {
        status.conditions = [];
      }
    }
    
    // 添加新的条件
    (resource.status as ResourceStatus).conditions.push({
      type: 'Reconciled',
      status: 'False',
      reason: 'ReconciliationFailed',
      message: error.message || 'Unknown error occurred during reconciliation',
      lastTransitionTime: new Date().toISOString(),
    });
    
    // 发布失败事件
    this.eventBus.publish(`${resource.kind.toLowerCase()}.reconciliation.failed`, {
      resourceId: this.getResourceId(resource),
      error: error.message || 'Unknown error'
    });
  }

  /**
   * 清理资源
   * 在资源被标记为删除时执行清理操作
   */
  protected async cleanupResource(resource: T): Promise<void> {
    // 默认实现为空，子类可以根据需要重写
    console.log(`Cleaning up resource ${resource.kind}/${resource.metadata.name}`);
  }

  /**
   * 更新资源状态
   * @param resource 资源对象
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected abstract updateResourceState(
    resource: T, 
    desiredState: any, 
    currentState: any
  ): Promise<void>;

  /**
   * 获取期望状态
   * @param resource 资源对象
   */
  abstract getDesiredState(resource: T): Promise<any>;

  /**
   * 获取当前状态
   * @param resource 资源对象
   */
  abstract getCurrentState(resource: T): Promise<any>;
}

/**
 * 资源控制器基类
 * 负责资源的生命周期管理和状态更新
 */
export abstract class ResourceController<T extends RuntimeResource> {
  constructor(
    protected eventBus: EventBus
  ) {}
  
  /**
   * 协调资源状态
   * 确保资源的当前状态与期望状态一致
   */
  async reconcile(resource: T): Promise<T> {
    try {
      // 获取期望状态
      const desiredState = await this.getDesiredState(resource);
      
      // 获取当前状态
      const currentState = await this.getCurrentState(resource);
      
      // 如果状态不一致，进行更新
      if (currentState !== desiredState) {
        await this.updateResourceState(resource, desiredState);
      }
      
      // 发布成功事件
      this.publishSuccessEvent(resource, desiredState);
      
      return resource;
    } catch (error) {
      // 处理协调失败
      await this.handleReconcileFailure(resource, error as Error);
      throw error;
    }
  }
  
  /**
   * 获取资源期望状态
   */
  protected abstract getDesiredState(resource: T): Promise<ResourcePhase>;
  
  /**
   * 获取资源当前状态
   */
  protected abstract getCurrentState(resource: T): Promise<ResourcePhase>;
  
  /**
   * 更新资源状态
   */
  protected abstract updateResourceState(resource: T, phase: ResourcePhase): Promise<void>;
  
  /**
   * 处理协调失败
   */
  protected abstract handleReconcileFailure(resource: T, error: Error): Promise<void>;
  
  /**
   * 发布资源成功事件
   */
  protected publishSuccessEvent(resource: T, phase: ResourcePhase): void {
    this.eventBus.publish(`${resource.kind}.reconciled`, { 
      resource,
      phase
    });
  }
  
  /**
   * 发布资源失败事件
   */
  protected publishFailureEvent(resource: T, error: Error): void {
    this.eventBus.publish(`${resource.kind}.failed`, {
      resource,
      error: error.message,
      stack: error.stack
    });
  }
  
  /**
   * 验证资源是否满足必要条件
   */
  protected validateResource(resource: T): void {
    if (!resource.apiVersion) {
      throw new Error(`Missing apiVersion in ${resource.kind} resource`);
    }
    
    if (!resource.metadata || !resource.metadata.name) {
      throw new Error(`Missing metadata.name in ${resource.kind} resource`);
    }
    
    if (!resource.spec) {
      throw new Error(`Missing spec in ${resource.kind} resource`);
    }
  }
} 