import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { ResourceScheduler } from '../../../src/core/scheduler/resource-scheduler';
import { AbstractController, ControllerEvents } from '../../../src/core/controller/abstract-controller';
import { RuntimeResource } from '../../../src/types';

// 测试资源类型
interface TestResource extends RuntimeResource {
  spec: {
    value: string;
  };
  status?: {
    currentValue?: string;
    retryCount?: number;
  };
}

// 测试控制器实现
class TestController extends AbstractController<TestResource> {
  private resources: Map<string, TestResource> = new Map();
  
  constructor(
    eventBus: EventBus<ControllerEvents<TestResource>>,
    scheduler: ResourceScheduler
  ) {
    super(eventBus, scheduler, 'Test');
  }
  
  protected watchResources(): void {
    // 简单实现：不做任何事
  }
  
  protected async listResources(): Promise<TestResource[]> {
    return Array.from(this.resources.values());
  }
  
  protected async getDesiredState(resource: TestResource): Promise<any> {
    return {
      value: resource.spec.value
    };
  }
  
  protected async getCurrentState(resource: TestResource): Promise<any> {
    return {
      value: resource.status?.currentValue
    };
  }
  
  protected async updateResource(
    resource: TestResource,
    currentState: any,
    desiredState: any
  ): Promise<void> {
    resource.status = {
      ...resource.status,
      currentValue: desiredState.value
    };
    this.resources.set(resource.metadata.name, resource);
  }
  
  // 测试辅助方法
  addResource(resource: TestResource): void {
    this.resources.set(resource.metadata.name, resource);
  }
  
  getResource(name: string): TestResource | undefined {
    return this.resources.get(name);
  }
}

describe('AbstractController', () => {
  let eventBus: EventBus<ControllerEvents<TestResource>>;
  let scheduler: ResourceScheduler;
  let controller: TestController;
  
  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus<ControllerEvents<TestResource>>();
    scheduler = new ResourceScheduler();
    controller = new TestController(eventBus, scheduler);
    
    // 监听事件
    vi.spyOn(eventBus, 'emit');
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('基本功能', () => {
    it('应该能够启动和停止控制器', () => {
      controller.start();
      expect(controller['isRunning']).toBe(true);
      
      controller.stop();
      expect(controller['isRunning']).toBe(false);
    });
    
    it('应该定期执行协调', async () => {
      const resource: TestResource = {
        apiVersion: 'test/v1',
        kind: 'Test',
        metadata: {
          name: 'test-resource'
        },
        spec: {
          value: 'test'
        }
      };
      
      controller.addResource(resource);
      controller.start();
      
      // 前进时间，触发第一次协调
      vi.advanceTimersByTime(5000);
      
      // 等待协调完成
      await vi.runAllTimersAsync();
      
      // 验证资源状态已更新
      const updatedResource = controller.getResource('test-resource');
      expect(updatedResource?.status?.currentValue).toBe('test');
      
      // 验证事件发送
      expect(eventBus.emit).toHaveBeenCalledWith(
        'controller.reconcile.start',
        expect.any(Object)
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'controller.reconcile.success',
        expect.any(Object)
      );
    });
  });
  
  describe('资源协调', () => {
    it('应该正确协调资源状态', async () => {
      const resource: TestResource = {
        apiVersion: 'test/v1',
        kind: 'Test',
        metadata: {
          name: 'test-resource'
        },
        spec: {
          value: 'desired-value'
        },
        status: {
          currentValue: 'current-value'
        }
      };
      
      controller.addResource(resource);
      await controller.reconcile(resource);
      
      // 验证状态已更新
      const updatedResource = controller.getResource('test-resource');
      expect(updatedResource?.status?.currentValue).toBe('desired-value');
      
      // 验证事件发送
      expect(eventBus.emit).toHaveBeenCalledWith(
        'controller.reconcile.success',
        expect.any(Object)
      );
    });
    
    it('应该处理协调错误和重试', async () => {
      const resource: TestResource = {
        apiVersion: 'test/v1',
        kind: 'Test',
        metadata: {
          name: 'test-resource'
        },
        spec: {
          value: 'test'
        }
      };
      
      // 模拟更新失败
      vi.spyOn(controller as any, 'updateResource').mockRejectedValueOnce(
        new Error('Update failed')
      );
      
      controller.addResource(resource);
      await controller.reconcile(resource);
      
      // 验证错误事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        'controller.reconcile.error',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
      
      // 验证重试调度
      expect(scheduler['queue'].length).toBe(1);
    });
  });
  
  describe('状态比较', () => {
    it('应该正确判断状态是否需要更新', () => {
      const currentState = { value: 'current' };
      const desiredState = { value: 'desired' };
      
      expect(controller['needsUpdate'](currentState, desiredState)).toBe(true);
      expect(controller['needsUpdate'](currentState, currentState)).toBe(false);
    });
  });
  
  describe('重试机制', () => {
    it('应该根据重试次数计算延迟', () => {
      expect(controller['calculateRetryDelay'](0)).toBe(1000); // 基础延迟
      expect(controller['calculateRetryDelay'](1)).toBe(2000); // 2倍延迟
      expect(controller['calculateRetryDelay'](2)).toBe(4000); // 4倍延迟
      expect(controller['calculateRetryDelay'](10)).toBe(30000); // 最大延迟
    });
    
    it('应该在达到最大重试次数后停止重试', async () => {
      const resource: TestResource = {
        apiVersion: 'test/v1',
        kind: 'Test',
        metadata: {
          name: 'test-resource'
        },
        spec: {
          value: 'test'
        },
        status: {
          retryCount: 3 // 已达到最大重试次数
        }
      };
      
      // 模拟更新失败
      vi.spyOn(controller as any, 'updateResource').mockRejectedValueOnce(
        new Error('Update failed')
      );
      
      controller.addResource(resource);
      await controller.reconcile(resource);
      
      // 验证没有调度重试
      expect(scheduler['queue'].length).toBe(0);
    });
  });
}); 