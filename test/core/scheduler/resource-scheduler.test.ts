import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { 
  ResourceScheduler, 
  TaskPriority, 
  SchedulerConfig 
} from '../../../src/core/scheduler/resource-scheduler';
import { RuntimeResource } from '../../../src/types';

interface SchedulerEvents {
  taskSubmitted: { taskId: string };
  taskCompleted: { taskId: string };
  taskFailed: { taskId: string; error: Error };
  taskRetrying: { taskId: string; retryCount: number };
  taskCancelled: { taskId: string };
}

// 模拟资源
const createMockResource = (name: string, kind: string = 'TestResource'): RuntimeResource => ({
  apiVersion: 'mastra.ai/v1',
  kind,
  metadata: {
    name,
    namespace: 'default'
  },
  spec: {}
});

describe('ResourceScheduler', () => {
  let eventBus: EventBus<SchedulerEvents>;
  let scheduler: ResourceScheduler;
  
  // 模拟时间函数
  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus<SchedulerEvents>();
    
    // 监听事件总线上的事件
    vi.spyOn(eventBus, 'publish');
    
    // 创建调度器实例
    const config: SchedulerConfig = {
      maxConcurrentTasks: 3,
      resourceTypeConcurrencyLimits: { 'Test': 2 },
      groupConcurrencyLimits: { 'test-group': 2 },
      defaultTaskTimeoutMs: 1000,
      defaultMaxRetries: 2
    };
    scheduler = new ResourceScheduler(eventBus, config);
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('基本功能', () => {
    it('应该能够正确初始化调度器', () => {
      expect(scheduler).toBeDefined();
    });
    
    it('应该能够启动和停止调度器', () => {
      // 启动调度器
      scheduler.start();
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.started', expect.any(Object));
      
      // 停止调度器
      scheduler.stop();
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.stopped', expect.any(Object));
    });
    
    it('应该能够更新调度器配置', () => {
      // 更新配置
      scheduler.updateConfig({
        maxConcurrentTasks: 5
      });
      
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.config.updated', expect.objectContaining({
        config: expect.objectContaining({
          maxConcurrentTasks: 5
        })
      }));
    });
  });
  
  describe('任务调度', () => {
    it('应该能够提交并执行任务', async () => {
      // 创建任务处理函数
      const taskHandler = vi.fn().mockResolvedValue('success');
      
      // 启动调度器
      scheduler.start();
      
      // 提交任务
      const resultPromise = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('test-resource'),
        type: 'test',
        handler: taskHandler
      });
      
      // 检查任务提交事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.submitted', expect.any(Object));
      
      // 前进时间，让任务执行
      vi.advanceTimersByTime(100);
      
      // 检查任务开始事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.started', expect.any(Object));
      
      // 等待任务完成
      const result = await resultPromise;
      
      // 验证结果
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: 'success',
        taskType: 'test'
      }));
      
      // 检查任务完成事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.completed', expect.any(Object));
      
      // 验证任务处理函数被调用
      expect(taskHandler).toHaveBeenCalledTimes(1);
    });
    
    it('应该按优先级执行任务', async () => {
      // 创建任务处理函数
      const results: string[] = [];
      const createTaskHandler = (name: string) => async () => {
        results.push(name);
        return name;
      };
      
      // 启动调度器
      scheduler.start();
      
      // 提交多个任务，按不同优先级
      const lowPriorityPromise = scheduler.scheduleTask({
        priority: TaskPriority.Low,
        resource: createMockResource('low-resource'),
        type: 'test',
        handler: createTaskHandler('low')
      });
      
      const highPriorityPromise = scheduler.scheduleTask({
        priority: TaskPriority.High,
        resource: createMockResource('high-resource'),
        type: 'test',
        handler: createTaskHandler('high')
      });
      
      const normalPriorityPromise = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('normal-resource'),
        type: 'test',
        handler: createTaskHandler('normal')
      });
      
      const criticalPriorityPromise = scheduler.scheduleTask({
        priority: TaskPriority.Critical,
        resource: createMockResource('critical-resource'),
        type: 'test',
        handler: createTaskHandler('critical')
      });
      
      // 前进时间，让任务执行
      vi.advanceTimersByTime(200);
      
      // 等待任务完成
      await Promise.all([
        lowPriorityPromise,
        highPriorityPromise,
        normalPriorityPromise,
        criticalPriorityPromise
      ]);
      
      // 验证执行顺序，应该是按优先级高到低执行
      // 由于配置中maxConcurrentTasks=3，所以最多同时执行三个任务
      // 优先级最高的三个任务（critical, high, normal）应该先执行
      expect(results[0]).toBe('critical');
      expect(results[1]).toBe('high');
      expect(results[2]).toBe('normal');
    });
    
    it('应该处理任务失败和重试', async () => {
      // 创建任务处理函数
      const errorHandler = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEOUT: Connection timeout'))
        .mockResolvedValueOnce('success after retry');
      
      // 启动调度器
      scheduler.start();
      
      // 提交任务
      const resultPromise = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('test-resource'),
        type: 'test',
        handler: errorHandler,
        maxRetries: 1
      });
      
      // 前进时间，让任务执行
      vi.advanceTimersByTime(100);
      
      // 检查任务失败事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.failed', expect.any(Object));
      
      // 检查任务重试事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.retry', expect.any(Object));
      
      // 前进时间，让重试任务执行
      vi.advanceTimersByTime(2000);
      
      // 等待任务完成
      const result = await resultPromise;
      
      // 验证结果
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: 'success after retry',
        attempts: 2
      }));
      
      // 验证任务处理函数被调用次数
      expect(errorHandler).toHaveBeenCalledTimes(2);
    });
    
    it('应该正确处理任务超时', async () => {
      // 创建一个永远不会解析的任务
      const timeoutHandler = vi.fn(() => {
        return new Promise((resolve) => {
          // 这个Promise永远不会解析
        });
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交任务，超时设置为500ms
      const resultPromise = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('test-resource'),
        type: 'test',
        handler: timeoutHandler,
        timeoutMs: 500,
        maxRetries: 0 // 不重试
      });
      
      // 前进时间，让任务执行但不足以触发超时
      vi.advanceTimersByTime(100);
      
      // 验证任务已开始执行
      expect(timeoutHandler).toHaveBeenCalled();
      
      // 前进时间，触发超时
      vi.advanceTimersByTime(500);
      
      // 等待任务完成（失败）
      const result = await resultPromise;
      
      // 验证结果
      expect(result).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('timed out')
        })
      }));
      
      // 检查任务失败事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.failed', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('timed out')
        })
      }));
    });
  });
  
  describe('并发控制', () => {
    it('应该尊重全局最大并发任务数限制', async () => {
      // 创建带有延迟的任务处理函数
      const taskHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      // 更新配置，限制最大并发任务数为3
      scheduler = new ResourceScheduler(eventBus, {
        maxConcurrentTasks: 3
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交3个任务
      const promises = [
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource1'),
          type: 'test',
          handler: taskHandler
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource2'),
          type: 'test',
          handler: taskHandler
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource3'),
          type: 'test',
          handler: taskHandler
        })
      ];
      
      // 前进时间100ms，让调度器处理队列
      vi.advanceTimersByTime(100);
      
      // 获取调度器统计信息
      const stats = scheduler.getStats();
      
      // 应该有3个正在运行的任务，0个在队列中
      expect(stats.runningTasksCount).toBe(3);
      expect(stats.queuedTasksCount).toBe(0);
      
      // 前进时间，让任务完成
      vi.advanceTimersByTime(1000);
      
      // 此时应该有0个正在运行的任务，0个在队列中
      const statsAfter = scheduler.getStats();
      expect(statsAfter.runningTasksCount).toBe(0);
      expect(statsAfter.queuedTasksCount).toBe(0);
      
      // 再前进时间，让所有任务完成
      vi.advanceTimersByTime(1000);
      
      // 等待所有任务完成
      await Promise.all(promises);
      
      // 任务处理函数应该被调用3次
      expect(taskHandler).toHaveBeenCalledTimes(3);
    });
    
    it('应该尊重资源类型并发限制', async () => {
      // 创建带有延迟的任务处理函数
      const taskHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      // 更新配置，限制Agent资源类型最大并发任务数为2
      scheduler = new ResourceScheduler(eventBus, {
        maxConcurrentTasks: 3,
        resourceTypeConcurrencyLimits: {
          'Agent': 2
        }
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交2个Agent任务和1个Tool任务
      const promises = [
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('agent1', 'Agent'),
          type: 'test',
          handler: taskHandler
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('agent2', 'Agent'),
          type: 'test',
          handler: taskHandler
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('tool1', 'Tool'),
          type: 'test',
          handler: taskHandler
        })
      ];
      
      // 前进时间100ms，让调度器处理队列
      vi.advanceTimersByTime(100);
      
      // 获取调度器统计信息
      const stats = scheduler.getStats();
      
      // 由于Agent资源类型限制为2，应该有2个任务正在运行
      // - 2个Agent任务
      // 还有1个Agent任务在队列中
      expect(stats.runningTasksCount).toBe(2);
      expect(stats.queuedTasksCount).toBe(1);
      expect(stats.resourceTypeStats['Agent']).toBe(2);
      expect(stats.resourceTypeStats['Tool']).toBe(1);
      
      // 前进时间，让任务完成
      vi.advanceTimersByTime(1000);
      
      // 此时应该有0个正在运行的任务，0个在队列中
      const statsAfter = scheduler.getStats();
      expect(statsAfter.runningTasksCount).toBe(0);
      expect(statsAfter.queuedTasksCount).toBe(0);
      
      // 再前进时间，让所有任务完成
      vi.advanceTimersByTime(1000);
      
      // 等待所有任务完成
      await Promise.all(promises);
      
      // 任务处理函数应该被调用3次
      expect(taskHandler).toHaveBeenCalledTimes(3);
    });
    
    it('应该尊重任务组并发限制', async () => {
      // 创建带有延迟的任务处理函数
      const taskHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      // 更新配置，限制group1最大并发任务数为2
      scheduler = new ResourceScheduler(eventBus, {
        maxConcurrentTasks: 3,
        groupConcurrencyLimits: {
          'group1': 2
        }
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交2个group1任务和1个group2任务
      const promises = [
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource1'),
          type: 'test',
          handler: taskHandler,
          groupKey: 'group1'
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource2'),
          type: 'test',
          handler: taskHandler,
          groupKey: 'group1'
        }),
        scheduler.scheduleTask({
          priority: TaskPriority.Normal,
          resource: createMockResource('resource3'),
          type: 'test',
          handler: taskHandler,
          groupKey: 'group2'
        })
      ];
      
      // 前进时间100ms，让调度器处理队列
      vi.advanceTimersByTime(100);
      
      // 获取调度器统计信息
      const stats = scheduler.getStats();
      
      // 由于group1限制为2，应该有2个任务正在运行
      // - 2个group1任务
      // - 1个group2任务
      // 还有1个group1任务在队列中
      expect(stats.runningTasksCount).toBe(2);
      expect(stats.queuedTasksCount).toBe(1);
      
      // 前进时间，让任务完成
      vi.advanceTimersByTime(1000);
      
      // 此时应该有0个正在运行的任务，0个在队列中
      const statsAfter = scheduler.getStats();
      expect(statsAfter.runningTasksCount).toBe(0);
      expect(statsAfter.queuedTasksCount).toBe(0);
      
      // 再前进时间，让所有任务完成
      vi.advanceTimersByTime(1000);
      
      // 等待所有任务完成
      await Promise.all(promises);
      
      // 任务处理函数应该被调用3次
      expect(taskHandler).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('任务管理', () => {
    it('应该能够取消队列中的任务', async () => {
      // 创建带有延迟的任务处理函数
      const taskHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      // 更新配置，限制最大并发任务数为3
      scheduler = new ResourceScheduler(eventBus, {
        maxConcurrentTasks: 3
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交两个任务
      const promise1 = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('resource1'),
        type: 'test',
        handler: taskHandler
      });
      
      const promise2 = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('resource2'),
        type: 'test',
        handler: taskHandler
      });
      
      // 前进时间，让第一个任务开始执行但不完成
      vi.advanceTimersByTime(100);
      
      // 获取第二个任务的ID
      const taskId = promise2.then(result => result.taskId);
      
      // 等待任务ID
      const id = await taskId;
      
      // 取消第二个任务
      const cancelled = scheduler.cancelTask(id);
      
      // 验证任务被取消
      expect(cancelled).toBe(true);
      
      // 检查任务取消事件
      expect(eventBus.publish).toHaveBeenCalledWith('scheduler.task.cancelled', expect.objectContaining({
        taskId: id
      }));
      
      // 任务结果应该显示取消状态
      const result2 = await promise2;
      expect(result2).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Task cancelled'
        })
      }));
      
      // 前进时间，让第一个任务完成
      vi.advanceTimersByTime(1000);
      
      // 等待第一个任务完成
      const result1 = await promise1;
      expect(result1).toEqual(expect.objectContaining({
        success: true,
        data: 'success'
      }));
      
      // 任务处理函数应该只被调用1次（第一个任务）
      expect(taskHandler).toHaveBeenCalledTimes(1);
    });
    
    it('应该能够获取任务状态', async () => {
      // 创建带有延迟的任务处理函数
      const taskHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      // 更新配置，限制最大并发任务数为3
      scheduler = new ResourceScheduler(eventBus, {
        maxConcurrentTasks: 3
      });
      
      // 启动调度器
      scheduler.start();
      
      // 提交两个任务
      const promise1 = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('resource1'),
        type: 'test',
        handler: taskHandler
      });
      
      const promise2 = scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: createMockResource('resource2'),
        type: 'test',
        handler: taskHandler
      });
      
      // 前进时间，让调度器处理队列
      vi.advanceTimersByTime(100);
      
      // 获取任务ID
      const taskId1 = await promise1.then(result => result.taskId);
      const taskId2 = await promise2.then(result => result.taskId);
      
      // 检查任务状态
      expect(scheduler.getTaskStatus(taskId1)).toBe('running');
      expect(scheduler.getTaskStatus(taskId2)).toBe('queued');
      
      // 前进时间，让第一个任务完成
      vi.advanceTimersByTime(1000);
      
      // 再检查任务状态
      expect(scheduler.getTaskStatus(taskId1)).toBe('not_found'); // 已完成
      expect(scheduler.getTaskStatus(taskId2)).toBe('running'); // 正在运行
      
      // 前进时间，让第二个任务完成
      vi.advanceTimersByTime(1000);
      
      // 再检查任务状态
      expect(scheduler.getTaskStatus(taskId1)).toBe('not_found');
      expect(scheduler.getTaskStatus(taskId2)).toBe('not_found');
    });
  });
}); 