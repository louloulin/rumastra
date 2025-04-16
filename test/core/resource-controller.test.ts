import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ResourceController, 
  ExponentialBackoffRetry,
  RetryStrategy
} from '../../src/core/controller/resource-controller';
import { EventBus } from '../../src/core/eventbus';
import { ResourcePhase, ConditionType, ConditionStatus } from '../../src/core/state/resource-status';
import { RuntimeResource } from '../../src/types';

// 定义测试用的资源类型
interface TestResource extends RuntimeResource {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: {
    field1: string;
    field2?: number;
    dependencies?: string[];
  };
  status?: any;
}

// 创建一个具体的控制器实现用于测试
class TestController extends ResourceController<TestResource> {
  private mockDesiredState: any;
  private mockCurrentState: any;
  private mockUpdateFn: any;
  private mockCleanupFn: any;
  private mockValidationError: Error | null = null;
  private mockDependencyError: Error | null = null;
  private mockStateError: Error | null = null;
  private mockUpdateError: Error | null = null;

  constructor(
    eventBus: EventBus,
    retryStrategy?: RetryStrategy
  ) {
    super(eventBus, retryStrategy);
    
    // 默认值
    this.mockDesiredState = { status: 'ready' };
    this.mockCurrentState = { status: 'pending' };
    this.mockUpdateFn = vi.fn().mockResolvedValue(undefined);
    this.mockCleanupFn = vi.fn().mockResolvedValue(undefined);
    
    // 配置更短的重调间隔，方便测试
    this.reconcileIntervalMs = 100;
  }

  getResourceKind(): string {
    return 'TestResource';
  }

  async getDesiredState(resource: TestResource): Promise<any> {
    if (this.mockStateError) {
      throw this.mockStateError;
    }
    return this.mockDesiredState;
  }

  async getCurrentState(resource: TestResource): Promise<any> {
    if (this.mockStateError) {
      throw this.mockStateError;
    }
    return this.mockCurrentState;
  }

  protected async updateResourceState(
    resource: TestResource,
    desiredState: any,
    currentState: any
  ): Promise<void> {
    if (this.mockUpdateError) {
      throw this.mockUpdateError;
    }
    return this.mockUpdateFn(resource, desiredState, currentState);
  }

  protected validateResource(resource: TestResource): void {
    super.validateResource(resource);
    
    if (this.mockValidationError) {
      throw this.mockValidationError;
    }
    
    // 自定义验证逻辑
    if (!resource.spec.field1) {
      throw new Error('field1 is required');
    }
  }
  
  protected async resolveDependencies(resource: TestResource): Promise<void> {
    if (this.mockDependencyError) {
      throw this.mockDependencyError;
    }
    
    // 如果有依赖，检查依赖
    if (resource.spec.dependencies && resource.spec.dependencies.length > 0) {
      // 在实际实现中，这里会检查依赖是否存在
    }
  }
  
  async cleanupResource(resource: TestResource): Promise<void> {
    return this.mockCleanupFn(resource);
  }
  
  // 测试辅助方法
  setMockStates(current: any, desired: any): void {
    this.mockCurrentState = current;
    this.mockDesiredState = desired;
  }
  
  setMockErrors(validation: Error | null = null, dependency: Error | null = null, state: Error | null = null, update: Error | null = null): void {
    this.mockValidationError = validation;
    this.mockDependencyError = dependency;
    this.mockStateError = state;
    this.mockUpdateError = update;
  }
  
  getMockUpdateFn() {
    return this.mockUpdateFn;
  }
  
  getMockCleanupFn() {
    return this.mockCleanupFn;
  }
}

describe('ResourceController', () => {
  let controller: TestController;
  let eventBus: EventBus;
  let resource: TestResource;
  
  // mock定时器
  beforeEach(() => {
    vi.useFakeTimers();
    
    // 初始化事件总线
    eventBus = new EventBus();
    
    // 初始化控制器
    controller = new TestController(eventBus);
    
    // 初始化测试资源
    resource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'TestResource',
      metadata: {
        name: 'test-resource',
        namespace: 'default'
      },
      spec: {
        field1: 'value1',
        field2: 42
      }
    };
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  
  describe('基本功能', () => {
    it('应该正确初始化控制器', () => {
      expect(controller).toBeDefined();
    });
    
    it('应该使用提供的事件总线', () => {
      const eventBusSpy = vi.spyOn(eventBus, 'subscribe');
      const controller = new TestController(eventBus);
      
      expect(eventBusSpy).toHaveBeenCalled();
    });
    
    it('应该返回正确的资源类型', () => {
      expect(controller.getResourceKind()).toBe('TestResource');
    });
  });
  
  describe('资源监视', () => {
    it('调用watch方法应该开始资源协调循环', async () => {
      const reconcileSpy = vi.spyOn(controller, 'reconcile');
      
      controller.watch(resource);
      
      expect(reconcileSpy).toHaveBeenCalledWith(resource);
      
      // 等待定时器触发下一次调和
      vi.advanceTimersByTime(200);
      
      expect(reconcileSpy).toHaveBeenCalledTimes(2);
    });
    
    it('应该在资源创建事件时开始协调', () => {
      const startLoopSpy = vi.spyOn(controller as any, 'startReconcileLoop');
      
      eventBus.publish('testresource.created', { resource });
      
      expect(startLoopSpy).toHaveBeenCalledWith(resource);
    });
    
    it('应该在资源更新事件时重新开始协调', () => {
      const startLoopSpy = vi.spyOn(controller as any, 'startReconcileLoop');
      
      eventBus.publish('testresource.updated', { resource });
      
      expect(startLoopSpy).toHaveBeenCalledWith(resource);
    });
    
    it('应该在资源删除事件时停止协调循环', () => {
      const stopLoopSpy = vi.spyOn(controller as any, 'stopReconcileLoop');
      const resourceId = controller['getResourceId'](resource);
      
      eventBus.publish('testresource.deleted', { resource });
      
      expect(stopLoopSpy).toHaveBeenCalledWith(resourceId);
    });
  });
  
  describe('资源协调', () => {
    it('应该正确执行完整的协调流程', async () => {
      const updateSpy = controller.getMockUpdateFn();
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      controller.setMockStates({ status: 'pending' }, { status: 'ready' });
      
      await controller.reconcile(resource);
      
      // 验证状态更新被调用
      expect(updateSpy).toHaveBeenCalled();
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.state.updated',
        expect.objectContaining({
          resourceId: 'default.test-resource',
          kind: 'TestResource'
        })
      );
      
      // 验证reconciled事件
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.reconciled',
        expect.objectContaining({
          resourceId: 'default.test-resource',
          kind: 'TestResource'
        })
      );
      
      // 验证资源状态已更新
      expect(resource.status).toBeDefined();
      expect(resource.status.phase).toBe(ResourcePhase.Running);
      
      // 验证条件已设置
      const reconcileCondition = resource.status.conditions.find(
        (c: any) => c.type === ConditionType.Reconciling
      );
      expect(reconcileCondition).toBeDefined();
      expect(reconcileCondition.status).toBe(ConditionStatus.False);
      expect(reconcileCondition.reason).toBe('ReconciliationCompleted');
    });
    
    it('当状态相同时不应该更新资源', async () => {
      const updateSpy = controller.getMockUpdateFn();
      
      // 设置相同的当前状态和期望状态
      const state = { status: 'ready' };
      controller.setMockStates(state, state);
      
      await controller.reconcile(resource);
      
      // 验证状态更新未被调用
      expect(updateSpy).not.toHaveBeenCalled();
    });
    
    it('应该处理资源删除', async () => {
      const cleanupSpy = controller.getMockCleanupFn();
      const publishSpy = vi.spyOn(eventBus, 'publish');
      const stopLoopSpy = vi.spyOn(controller as any, 'stopReconcileLoop');
      
      // 标记资源为删除状态
      (resource.metadata as any).deletionTimestamp = new Date().toISOString();
      
      await controller.reconcile(resource);
      
      // 验证清理方法被调用
      expect(cleanupSpy).toHaveBeenCalledWith(resource);
      
      // 验证协调循环被停止
      expect(stopLoopSpy).toHaveBeenCalled();
      
      // 验证删除完成事件被发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.deleted.completed',
        expect.objectContaining({
          resourceId: 'default.test-resource',
          kind: 'TestResource'
        })
      );
      
      // 验证资源状态已更新为Terminating
      expect(resource.status).toBeDefined();
      expect(resource.status.phase).toBe(ResourcePhase.Terminating);
    });
  });
  
  describe('错误处理', () => {
    it('应该处理验证错误', async () => {
      const validationError = new Error('Validation failed');
      controller.setMockErrors(validationError);
      
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      await controller.reconcile(resource);
      
      // 验证状态已更新为失败
      expect(resource.status).toBeDefined();
      expect(resource.status.phase).toBe(ResourcePhase.Failed);
      
      // 验证失败事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.validation.failed',
        expect.objectContaining({
          error: validationError.message
        })
      );
      
      // 验证状态转换事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.phase.changed',
        expect.objectContaining({
          previousPhase: ResourcePhase.Pending,
          currentPhase: ResourcePhase.Failed
        })
      );
    });
    
    it('应该处理依赖解析错误', async () => {
      const dependencyError = new Error('Dependency resolution failed');
      controller.setMockErrors(null, dependencyError);
      
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      await controller.reconcile(resource);
      
      // 验证状态已更新为失败
      expect(resource.status).toBeDefined();
      expect(resource.status.phase).toBe(ResourcePhase.Failed);
      
      // 验证失败事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.dependency.failed',
        expect.objectContaining({
          error: dependencyError.message
        })
      );
    });
    
    it('应该处理状态获取错误', async () => {
      const stateError = new Error('State retrieval failed');
      controller.setMockErrors(null, null, stateError);
      
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      await controller.reconcile(resource);
      
      // 验证状态已更新为未知
      expect(resource.status).toBeDefined();
      expect(resource.status.phase).toBe(ResourcePhase.Unknown);
      
      // 验证失败事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.state.retrieval.failed',
        expect.objectContaining({
          error: stateError.message
        })
      );
    });
    
    it('应该处理更新错误', async () => {
      const updateError = new Error('Update failed');
      controller.setMockErrors(null, null, null, updateError);
      
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // 确保状态不同，触发更新
      controller.setMockStates({ status: 'pending' }, { status: 'ready' });
      
      await controller.reconcile(resource);
      
      // 验证状态已更新为失败或降级
      expect(resource.status).toBeDefined();
      expect([ResourcePhase.Failed, ResourcePhase.Degraded]).toContain(resource.status.phase);
      
      // 验证失败事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.update.failed',
        expect.objectContaining({
          error: updateError.message
        })
      );
    });
  });
  
  describe('重试机制', () => {
    it('应该在失败时调度重试', async () => {
      // 创建可重试的错误
      const retryableError = new Error('ETIMEOUT: Connection timeout');
      (retryableError as any).isRetryable = true;
      
      controller.setMockErrors(null, null, null, retryableError);
      
      // 确保状态不同，触发更新
      controller.setMockStates({ status: 'pending' }, { status: 'ready' });
      
      const publishSpy = vi.spyOn(eventBus, 'publish');
      const reconcileSpy = vi.spyOn(controller, 'reconcile');
      
      // 第一次协调失败
      await controller.reconcile(resource);
      
      // 验证重试事件已发布
      expect(publishSpy).toHaveBeenCalledWith(
        'testresource.retry.scheduled',
        expect.objectContaining({
          retryCount: 1
        })
      );
      
      // 验证重试计数已增加
      expect(resource.status.details.retryCount).toBe(1);
      
      // 验证下一次重试时间已设置
      expect(resource.status.details.nextRetryTime).toBeDefined();
      
      // 重置mock以便重试成功
      controller.setMockErrors();
      reconcileSpy.mockClear();
      
      // 前进时间以触发重试
      vi.advanceTimersByTime(2000);
      
      // 验证重试已执行
      expect(reconcileSpy).toHaveBeenCalled();
    });
    
    it('指数退避重试策略应该正确计算延迟', () => {
      const strategy = new ExponentialBackoffRetry(1000, 30000, 5);
      const error = new Error('Test error');
      
      // 第一次重试
      const delay1 = strategy.calculateDelay(1, error);
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1250); // 基础值+最多25%的抖动
      
      // 第二次重试
      const delay2 = strategy.calculateDelay(2, error);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2500);
      
      // 第三次重试
      const delay3 = strategy.calculateDelay(3, error);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(5000);
    });
    
    it('超过最大重试次数后不应该继续重试', () => {
      const strategy = new ExponentialBackoffRetry(1000, 30000, 3);
      const error = new Error('ETIMEOUT: Connection timeout');
      
      // 前三次应该重试
      expect(strategy.shouldRetry(1, error)).toBe(true);
      expect(strategy.shouldRetry(2, error)).toBe(true);
      expect(strategy.shouldRetry(3, error)).toBe(true);
      
      // 第四次不应该重试
      expect(strategy.shouldRetry(4, error)).toBe(false);
    });
  });
  
  describe('并发控制', () => {
    it('应该防止同一资源的并发协调', async () => {
      // 创建一个不会立即解决的模拟
      const mockUpdateFn = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(undefined), 1000);
        });
      });
      
      // 替换更新函数
      controller['mockUpdateFn'] = mockUpdateFn;
      
      // 确保状态不同，触发更新
      controller.setMockStates({ status: 'pending' }, { status: 'ready' });
      
      // 启动第一次协调（不等待完成）
      const reconcilePromise = controller.reconcile(resource);
      
      // 立即尝试第二次协调
      await controller.reconcile(resource);
      
      // 更新函数应该只被调用一次
      expect(mockUpdateFn).toHaveBeenCalledTimes(1);
      
      // 完成第一次协调
      vi.advanceTimersByTime(1000);
      await reconcilePromise;
    });
  });
}); 