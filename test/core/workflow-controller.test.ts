import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowController, WorkflowEngine, WorkflowState } from '../../src/core/controllers/workflow-controller';
import { EventBus } from '../../src/core/eventbus';
import { WorkflowResource } from '../../src/types';
import { ResourcePhase } from '../../src/core/state/resource-status';

// 创建一个模拟的工作流引擎
class MockWorkflowEngine implements WorkflowEngine {
  private workflowState: WorkflowState;
  private shouldFail: boolean = false;
  private cancelFunction: () => void;
  
  constructor() {
    // 初始化默认状态
    this.workflowState = {
      status: 'pending',
      currentStepIndex: -1,
      steps: [],
      lastUpdated: new Date().toISOString()
    };
    
    this.cancelFunction = vi.fn();
  }
  
  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  setState(state: Partial<WorkflowState>): void {
    this.workflowState = { ...this.workflowState, ...state };
  }
  
  async execute(workflow: WorkflowResource, context?: Record<string, any>): Promise<any> {
    if (this.shouldFail) {
      throw new Error('Workflow execution failed');
    }
    
    // 模拟成功执行工作流
    const steps = workflow.spec.steps;
    const result = { success: true, steps: steps.length };
    
    // 更新工作流状态
    this.workflowState = {
      status: 'completed',
      currentStepIndex: steps.length - 1,
      steps: steps.map(step => ({
        name: step.name || '',
        status: 'completed',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      })),
      lastUpdated: new Date().toISOString(),
      output: result
    };
    
    return result;
  }
  
  async cancel(workflow: WorkflowResource): Promise<void> {
    this.cancelFunction();
    
    // 更新工作流状态
    this.workflowState.status = 'cancelled';
    this.workflowState.lastUpdated = new Date().toISOString();
  }
  
  async getStatus(workflow: WorkflowResource): Promise<WorkflowState> {
    return this.workflowState;
  }
  
  getCancelFunction(): any {
    return this.cancelFunction;
  }
}

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let eventBus: EventBus;
  let workflowEngine: MockWorkflowEngine;
  let workflow: WorkflowResource;
  
  // mock定时器
  beforeEach(() => {
    vi.useFakeTimers();
    
    // 初始化事件总线
    eventBus = new EventBus();
    
    // 初始化模拟工作流引擎
    workflowEngine = new MockWorkflowEngine();
    
    // 初始化控制器
    controller = new WorkflowController(eventBus, workflowEngine);
    
    // 初始化测试工作流
    workflow = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Workflow',
      metadata: {
        name: 'test-workflow',
        namespace: 'default'
      },
      spec: {
        name: 'Test Workflow',
        initialStep: 'step1',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            agent: 'agent1',
            next: 'step2'
          },
          {
            id: 'step2',
            name: 'Step 2',
            agent: 'agent2',
            next: 'step3'
          },
          {
            id: 'step3',
            name: 'Step 3',
            agent: 'agent3'
          }
        ]
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
    
    it('应该返回正确的资源类型', () => {
      expect(controller['getResourceKind']()).toBe('Workflow');
    });
  });
  
  describe('资源协调', () => {
    it('应该成功执行工作流', async () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      const executeSpy = vi.spyOn(workflowEngine, 'execute');
      
      // 初始化工作流状态
      workflowEngine.setState({ status: 'pending' });
      
      // 执行协调
      await controller.reconcile(workflow);
      
      // 验证工作流引擎的execute方法被调用
      expect(executeSpy).toHaveBeenCalledWith(workflow);
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith(
        'workflow.execution.started',
        expect.objectContaining({
          name: 'test-workflow',
          namespace: 'default'
        })
      );
      
      expect(publishSpy).toHaveBeenCalledWith(
        'workflow.execution.completed',
        expect.objectContaining({
          name: 'test-workflow',
          namespace: 'default',
          output: expect.objectContaining({ success: true })
        })
      );
      
      // 验证资源状态已更新
      expect(workflow.status).toBeDefined();
      expect(workflow.status?.phase).toBe('Completed');
    });
    
    it('应该处理工作流执行失败', async () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // 设置工作流引擎失败
      workflowEngine.setShouldFail(true);
      
      // 初始化工作流状态
      workflowEngine.setState({ status: 'pending' });
      
      // 执行协调（预期会抛出错误）
      await expect(controller.reconcile(workflow)).rejects.toThrow('Workflow execution failed');
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith(
        'workflow.execution.failed',
        expect.objectContaining({
          name: 'test-workflow',
          namespace: 'default',
          error: 'Workflow execution failed'
        })
      );
      
      // 验证资源状态已更新
      expect(workflow.status).toBeDefined();
      expect(workflow.status?.phase).toBe('Failed');
    });
    
    it('对于已完成的工作流不应再次执行', async () => {
      const executeSpy = vi.spyOn(workflowEngine, 'execute');
      
      // 初始化工作流状态为已完成
      workflowEngine.setState({ status: 'completed' });
      
      // 执行协调
      await controller.reconcile(workflow);
      
      // 验证工作流引擎的execute方法没有被调用
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('资源清理', () => {
    it('应该清理工作流资源', async () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      const cancelSpy = vi.fn();
      workflowEngine['cancelFunction'] = cancelSpy;
      
      // 设置工作流为运行中
      workflowEngine.setState({ status: 'running' });
      controller['runningWorkflows'].set('default.test-workflow', true);
      
      // 执行清理
      await controller.cleanupResource(workflow);
      
      // 验证取消方法被调用
      expect(cancelSpy).toHaveBeenCalled();
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith(
        'workflow.cleanup.completed',
        expect.objectContaining({
          name: 'test-workflow',
          namespace: 'default'
        })
      );
      
      // 验证运行中映射已清理
      expect(controller['runningWorkflows'].has('default.test-workflow')).toBe(false);
    });
  });
  
  describe('资源验证', () => {
    it('应该验证有效的工作流资源', () => {
      // 资源已在beforeEach中初始化，应该是有效的
      expect(() => controller['validateResource'](workflow)).not.toThrow();
    });
    
    it('应该检测到无效的工作流资源', () => {
      // 创建一个没有步骤的工作流
      const invalidWorkflow = {
        ...workflow,
        spec: {
          ...workflow.spec,
          steps: []
        }
      };
      
      expect(() => controller['validateResource'](invalidWorkflow)).toThrow('Workflow must have at least one step');
    });
    
    it('应该检测到循环依赖', () => {
      // 创建一个有循环依赖的工作流
      const cyclicWorkflow = {
        ...workflow,
        spec: {
          ...workflow.spec,
          steps: [
            {
              id: 'step1',
              name: 'Step 1',
              agent: 'agent1',
              next: 'step2'
            },
            {
              id: 'step2',
              name: 'Step 2',
              agent: 'agent2',
              next: 'step3'
            },
            {
              id: 'step3',
              name: 'Step 3',
              agent: 'agent3',
              next: 'step1' // 循环回到step1
            }
          ]
        }
      };
      
      expect(() => controller['validateResource'](cyclicWorkflow)).toThrow('Cyclic dependency detected');
    });
  });
}); 