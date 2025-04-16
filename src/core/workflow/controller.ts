import { AbstractController } from '../controller';
import { EventBus } from '../eventbus';
import { WorkflowResource, Condition } from '../../types';
import { ResourceScheduler, TaskPriority, SchedulerConfig, SchedulerEvents } from '../scheduler/resource-scheduler';

/**
 * 工作流事件类型
 */
export interface WorkflowEvents {
  'workflow.started': { workflowId: string; name: string };
  'workflow.completed': { workflowId: string; name: string; result: any };
  'workflow.failed': { workflowId: string; name: string; error: Error };
  'workflow.step.started': { workflowId: string; stepId: string; name: string };
  'workflow.step.completed': { workflowId: string; stepId: string; name: string; result: any };
  'workflow.step.failed': { workflowId: string; stepId: string; name: string; error: Error };
  'workflow.status.updated': { resourceId: string; status: any };
  'workflow.cleaned': { resource: WorkflowResource; workflowId: string };
}

/**
 * 工作流控制器选项
 */
export interface WorkflowControllerOptions {
  scheduler?: ResourceScheduler;
}

/**
 * 工作流控制器
 * 负责管理工作流资源的生命周期
 */
export class WorkflowController extends AbstractController<WorkflowResource> {
  private scheduler: ResourceScheduler;
  private runningWorkflows: Map<string, { 
    cancelFn?: () => void;
    currentStepId?: string;
  }> = new Map();

  /**
   * 创建一个新的工作流控制器
   * @param eventBus 事件总线
   * @param options 控制器选项
   */
  constructor(eventBus: EventBus, options: WorkflowControllerOptions = {}) {
    super(eventBus);
    
    // 如果没有提供调度器，则创建一个新的调度器，并带有适当的事件总线接口
    if (options.scheduler) {
      this.scheduler = options.scheduler;
    } else {
      // 创建专用的调度器事件总线，确保它有publish方法
      const schedulerEventBus = new EventBus<SchedulerEvents>();
      this.scheduler = new ResourceScheduler(schedulerEventBus);
      
      // 可选：转发调度器事件到主事件总线
      schedulerEventBus.on('taskSubmitted', (data) => {
        this.eventBus.publish('workflow.scheduler.task.started', data);
      });
      
      schedulerEventBus.on('taskCompleted', (data) => {
        this.eventBus.publish('workflow.scheduler.task.completed', data);
      });
      
      schedulerEventBus.on('taskFailed', (data) => {
        this.eventBus.publish('workflow.scheduler.task.failed', data);
      });
    }
    
    this.scheduler.start();

    // 订阅工作流执行请求事件
    this.eventBus.subscribe('workflow.execute', async (data: { 
      workflowId: string;
      context?: Record<string, any>;
    }) => {
      try {
        const workflowId = data.workflowId;
        const context = data.context || {};
        
        // 发布执行结果
        const result = await this.executeWorkflow(workflowId, context);
        this.eventBus.publish('workflow.execute.result', {
          workflowId,
          success: true,
          result
        });
      } catch (error) {
        this.eventBus.publish('workflow.execute.result', {
          workflowId: data.workflowId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * 获取工作流资源的期望状态
   * @param resource 工作流资源
   * @returns 期望状态
   */
  async getDesiredState(resource: WorkflowResource): Promise<any> {
    try {
      // 解析步骤依赖关系
      const steps = this.resolveStepDependencies(resource);
      
      // 验证工作流配置
      this.validateWorkflowConfig(resource);
      
      // 初始化工作流状态
      const state = this.initializeWorkflowState(resource);
      
      return {
        steps,
        state
      };
    } catch (error) {
      console.error(`Failed to get desired state for workflow ${this.getResourceId(resource)}:`, error);
      throw error;
    }
  }

  /**
   * 获取工作流资源的当前状态
   * @param resource 工作流资源
   * @returns 当前状态
   */
  async getCurrentState(resource: WorkflowResource): Promise<any> {
    // 在实际实现中，这里应该从状态存储中获取当前状态
    // 目前简单返回运行状态信息
    const workflowId = this.getResourceId(resource);
    const runningInfo = this.runningWorkflows.get(workflowId);
    
    return {
      isRunning: !!runningInfo,
      currentStepId: runningInfo?.currentStepId
    };
  }
  
  /**
   * 更新资源状态
   * @param resource 工作流资源
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected async updateResourceState(
    resource: WorkflowResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    // 确保状态对象始终存在
    if (!resource.status) {
      resource.status = {
        phase: 'Pending',
        conditions: []
      };
    }
    
    // 添加就绪条件
    const readyCondition: Condition = {
      type: 'Ready',
      status: 'True',
      reason: 'WorkflowReconciled',
      message: 'Workflow has been successfully reconciled',
      lastTransitionTime: new Date().toISOString()
    };
    
    // 更新状态
    if (currentState.isRunning) {
      resource.status.phase = 'Running';
      resource.status.currentStep = currentState.currentStepId;
    } else {
      resource.status.phase = 'Pending';
    }
    
    resource.status.conditions = [readyCondition];
    resource.status.lastExecutionTime = new Date().toISOString();
    
    // 发布更新事件
    this.eventBus.publish('workflow.status.updated', {
      resourceId: this.getResourceId(resource),
      status: resource.status
    });
  }
  
  /**
   * 清理资源
   * @param resource 工作流资源
   */
  protected async cleanupResource(resource: WorkflowResource): Promise<void> {
    const workflowId = this.getResourceId(resource);
    
    // 取消正在运行的工作流
    const runningInfo = this.runningWorkflows.get(workflowId);
    if (runningInfo && runningInfo.cancelFn) {
      runningInfo.cancelFn();
    }
    
    this.runningWorkflows.delete(workflowId);
    
    // 发布清理事件
    this.eventBus.publish('workflow.cleaned', {
      resource,
      workflowId
    });
  }
  
  /**
   * 执行工作流
   * @param workflowId 工作流ID
   * @param context 执行上下文
   * @returns 执行结果
   */
  async executeWorkflow(workflowId: string, context: Record<string, any> = {}): Promise<any> {
    // 查找工作流资源
    const workflowResources = await this.findWorkflowResources(workflowId);
    if (!workflowResources || workflowResources.length === 0) {
      throw new Error(`Workflow with ID ${workflowId} not found`);
    }
    
    const workflowResource = workflowResources[0];
    
    // 检查工作流是否已在运行
    if (this.runningWorkflows.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} is already running`);
    }
    
    // 创建运行信息
    let isCancelled = false;
    const runningInfo = {
      cancelFn: () => { isCancelled = true; }
    };
    this.runningWorkflows.set(workflowId, runningInfo);
    
    try {
      // 发布工作流开始事件
      this.eventBus.publish('workflow.started', {
        workflowId,
        name: workflowResource.metadata.name
      });
      
      // 更新工作流状态
      if (workflowResource.status) {
        workflowResource.status.phase = 'Running';
        workflowResource.status.lastExecutionTime = new Date().toISOString();
        
        // 发布状态更新事件
        this.eventBus.publish('workflow.status.updated', {
          resourceId: this.getResourceId(workflowResource),
          status: workflowResource.status
        });
      }
      
      // 获取初始步骤
      const initialStepId = workflowResource.spec.initialStep;
      if (!initialStepId) {
        throw new Error(`Workflow ${workflowId} does not have an initial step defined`);
      }
      
      // 执行工作流步骤
      const result = await this.executeWorkflowSteps(workflowResource, initialStepId, context, isCancelled);
      
      // 更新工作流状态为已完成
      if (workflowResource.status) {
        workflowResource.status.phase = 'Completed';
        workflowResource.status.lastExecutionTime = new Date().toISOString();
        
        // 发布状态更新事件
        this.eventBus.publish('workflow.status.updated', {
          resourceId: this.getResourceId(workflowResource),
          status: workflowResource.status
        });
      }
      
      // 发布工作流完成事件
      this.eventBus.publish('workflow.completed', {
        workflowId,
        name: workflowResource.metadata.name,
        result
      });
      
      // 移除运行信息
      this.runningWorkflows.delete(workflowId);
      
      return result;
    } catch (error) {
      // 更新工作流状态为失败
      if (workflowResource.status) {
        workflowResource.status.phase = 'Failed';
        workflowResource.status.lastExecutionTime = new Date().toISOString();
        
        // 发布状态更新事件
        this.eventBus.publish('workflow.status.updated', {
          resourceId: this.getResourceId(workflowResource),
          status: workflowResource.status
        });
      }
      
      // 发布工作流失败事件
      this.eventBus.publish('workflow.failed', {
        workflowId,
        name: workflowResource.metadata.name,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // 移除运行信息
      this.runningWorkflows.delete(workflowId);
      
      throw error;
    }
  }
  
  /**
   * 执行工作流步骤
   * @param workflow 工作流资源
   * @param stepId 步骤ID
   * @param context 执行上下文
   * @param isCancelled 是否已取消
   * @returns 执行结果
   */
  private async executeWorkflowSteps(
    workflow: WorkflowResource, 
    stepId: string, 
    context: Record<string, any>, 
    isCancelled: boolean
  ): Promise<any> {
    if (isCancelled) {
      throw new Error('Workflow execution was cancelled');
    }
    
    // 查找当前步骤
    const currentStep = workflow.spec.steps.find(step => step.id === stepId);
    if (!currentStep) {
      throw new Error(`Step ${stepId} not found in workflow ${workflow.metadata.name}`);
    }
    
    // 更新当前步骤
    const workflowId = this.getResourceId(workflow);
    const runningInfo = this.runningWorkflows.get(workflowId);
    if (runningInfo) {
      runningInfo.currentStepId = stepId;
    }
    
    if (workflow.status) {
      workflow.status.currentStep = stepId;
      
      // 发布状态更新事件
      this.eventBus.publish('workflow.status.updated', {
        resourceId: workflowId,
        status: workflow.status
      });
    }
    
    // 发布步骤开始事件
    this.eventBus.publish('workflow.step.started', {
      workflowId,
      stepId,
      name: currentStep.name
    });
    
    try {
      // 创建步骤执行任务
      const stepResult = await this.scheduler.scheduleTask({
        priority: TaskPriority.Normal,
        resource: workflow,
        type: `workflow.step.execute`,
        handler: async () => {
          // TODO: 在实际实现中，这里应该调用实际的步骤执行逻辑
          // 在这个简化版实现中，我们使用一个模拟的结果
          return {
            stepId,
            output: currentStep.output || { result: 'Step execution simulated' }
          };
        }
      });
      
      // 发布步骤完成事件
      this.eventBus.publish('workflow.step.completed', {
        workflowId,
        stepId,
        name: currentStep.name,
        result: stepResult.data
      });
      
      // 检查是否有下一步
      if (currentStep.next) {
        // 如果next是字符串，直接执行下一步
        if (typeof currentStep.next === 'string') {
          return this.executeWorkflowSteps(workflow, currentStep.next, {
            ...context,
            previousStepResult: stepResult.data
          }, isCancelled);
        }
        // 如果next是数组，按顺序执行所有步骤
        else if (Array.isArray(currentStep.next)) {
          let lastResult;
          for (const nextStepId of currentStep.next) {
            lastResult = await this.executeWorkflowSteps(workflow, nextStepId, {
              ...context,
              previousStepResult: stepResult.data
            }, isCancelled);
          }
          return lastResult;
        }
      }
      
      // 如果没有下一步，返回当前步骤的结果
      return stepResult.data;
    } catch (error) {
      // 发布步骤失败事件
      this.eventBus.publish('workflow.step.failed', {
        workflowId,
        stepId,
        name: currentStep.name,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      throw error;
    }
  }
  
  /**
   * 解析步骤依赖关系
   * @param resource 工作流资源
   * @returns 解析后的步骤配置
   */
  private resolveStepDependencies(resource: WorkflowResource): any[] {
    // 获取所有步骤ID
    const allStepIds = resource.spec.steps.map(step => step.id);
    
    // 检查步骤引用是否有效
    resource.spec.steps.forEach(step => {
      // 检查next字段
      if (step.next) {
        if (typeof step.next === 'string') {
          // 特殊情况：END表示工作流结束，作为有效的终点
          if (step.next !== 'END' && !allStepIds.includes(step.next)) {
            throw new Error(`Step ${step.id} references non-existent next step: ${step.next}`);
          }
        } else if (Array.isArray(step.next)) {
          step.next.forEach(nextStepId => {
            // 特殊情况：END表示工作流结束，作为有效的终点
            if (nextStepId !== 'END' && !allStepIds.includes(nextStepId)) {
              throw new Error(`Step ${step.id} references non-existent next step: ${nextStepId}`);
            }
          });
        }
      }
      
      // 检查agent字段
      if (step.agent) {
        // TODO: 在实际实现中，这里应该检查agent引用是否有效
      }
    });
    
    return resource.spec.steps;
  }
  
  /**
   * 验证工作流配置
   * @param resource 工作流资源
   */
  private validateWorkflowConfig(resource: WorkflowResource): void {
    // 检查初始步骤是否存在
    if (!resource.spec.initialStep) {
      throw new Error(`Workflow ${resource.metadata.name} does not have an initial step defined`);
    }
    
    const initialStepExists = resource.spec.steps.some(step => step.id === resource.spec.initialStep);
    if (!initialStepExists) {
      throw new Error(`Initial step ${resource.spec.initialStep} not found in workflow ${resource.metadata.name}`);
    }
    
    // 检查是否有步骤
    if (!resource.spec.steps || resource.spec.steps.length === 0) {
      throw new Error(`Workflow ${resource.metadata.name} does not have any steps defined`);
    }
  }
  
  /**
   * 初始化工作流状态
   * @param resource 工作流资源
   * @returns 初始状态
   */
  private initializeWorkflowState(resource: WorkflowResource): Record<string, any> {
    // 创建基本状态
    return {
      workflowId: this.getResourceId(resource),
      createdAt: new Date().toISOString(),
      steps: resource.spec.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: 'Pending'
      }))
    };
  }
  
  /**
   * 查找工作流资源
   * @param workflowId 工作流ID
   * @returns 工作流资源列表
   */
  private async findWorkflowResources(workflowId: string): Promise<WorkflowResource[]> {
    // TODO: 在实际实现中，这里应该查询状态存储
    // 在这个简化版实现中，我们使用一个硬编码的样例
    return [
      {
        apiVersion: 'mastra.ai/v1',
        kind: 'Workflow',
        metadata: {
          name: workflowId,
          namespace: 'default'
        },
        spec: {
          name: workflowId,
          description: 'Sample workflow',
          steps: [
            {
              id: 'step1',
              name: 'First Step',
              agent: 'default-agent',
              next: 'step2'
            },
            {
              id: 'step2',
              name: 'Second Step',
              agent: 'default-agent',
              next: ['step3', 'step4']
            },
            {
              id: 'step3',
              name: 'Third Step',
              agent: 'default-agent'
            },
            {
              id: 'step4',
              name: 'Fourth Step',
              agent: 'default-agent'
            }
          ],
          initialStep: 'step1'
        },
        status: {
          phase: 'Pending',
          conditions: []
        }
      }
    ];
  }
  
  /**
   * 解构控制器，停止所有活动
   */
  dispose(): void {
    // 停止调度器
    this.scheduler.stop();
    
    // 取消所有运行中的工作流
    for (const [workflowId, runningInfo] of this.runningWorkflows.entries()) {
      if (runningInfo.cancelFn) {
        runningInfo.cancelFn();
      }
    }
    
    this.runningWorkflows.clear();
  }
} 