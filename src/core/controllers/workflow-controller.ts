import { WorkflowResource, WorkflowStep } from '../../types';
import { EventBus } from '../eventbus';
import { ResourceController, RetryStrategy } from '../controller/resource-controller';
import { ResourcePhase, ResourceStatus, ResourceStatusManager, ConditionType, ConditionStatus } from '../state/resource-status';

/**
 * 工作流状态扩展类型
 * 用于描述工作流资源的状态
 */
export interface WorkflowStatus {
  // 使用首字母大写的状态来匹配types.ts中的定义
  phase: 'Pending' | 'Running' | 'Completed' | 'Failed';
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    lastTransitionTime: string;
  }>;
  lastTransitionTime?: string;
  lastExecutionTime?: string;
  currentStep?: number | string;
  steps?: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    output?: any;
    error?: string;
  }>;
  startTime?: string;
  endTime?: string;
  context?: Record<string, any>;
  output?: any;
  message?: string;
  reason?: string;
}

/**
 * 工作流状态
 * 表示工作流的状态数据结构
 */
export interface WorkflowState {
  /** 工作流状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** 当前执行中的步骤索引 */
  currentStepIndex: number;
  
  /** 步骤的状态 */
  steps: Array<{
    /** 步骤名称 */
    name: string;
    
    /** 步骤状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    
    /** 开始执行时间 */
    startTime?: string;
    
    /** 完成执行时间 */
    endTime?: string;
    
    /** 输出结果 */
    output?: any;
    
    /** 错误信息 */
    error?: string;
  }>;
  
  /** 工作流开始时间 */
  startTime?: string;
  
  /** 工作流结束时间 */
  endTime?: string;
  
  /** 工作流的全局上下文 */
  context?: Record<string, any>;
  
  /** 工作流输出 */
  output?: any;
  
  /** 最后一次更新时间 */
  lastUpdated: string;
}

// 状态映射函数：内部状态到API状态
function mapInternalToApiState(state: string): 'Pending' | 'Running' | 'Completed' | 'Failed' {
  switch (state.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
    case 'cancelled':
      return 'Failed';
    default:
      return 'Pending';
  }
}

// 状态映射函数：API状态到内部状态
function mapApiToInternalState(state: string): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' {
  switch (state) {
    case 'Pending':
      return 'pending';
    case 'Running':
      return 'running';
    case 'Completed':
      return 'completed';
    case 'Failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * 工作流引擎接口
 * 负责实际执行工作流
 */
export interface WorkflowEngine {
  /**
   * 执行工作流
   * @param workflow 工作流资源
   * @param context 执行上下文
   */
  execute(workflow: WorkflowResource, context?: Record<string, any>): Promise<any>;
  
  /**
   * 取消工作流执行
   * @param workflow 工作流资源
   */
  cancel(workflow: WorkflowResource): Promise<void>;
  
  /**
   * 获取工作流状态
   * @param workflow 工作流资源
   */
  getStatus(workflow: WorkflowResource): Promise<WorkflowState>;
}

/**
 * 工作流控制器
 * 负责管理工作流资源的生命周期
 */
export class WorkflowController extends ResourceController<WorkflowResource> {
  /** 工作流引擎 */
  private workflowEngine: WorkflowEngine;
  
  /** 运行中的工作流实例映射 */
  private runningWorkflows: Map<string, boolean> = new Map();
  
  /**
   * 构造函数
   * @param eventBus 事件总线
   * @param workflowEngine 工作流引擎
   * @param retryStrategy 可选的重试策略
   */
  constructor(
    eventBus: EventBus,
    workflowEngine: WorkflowEngine,
    retryStrategy?: RetryStrategy
  ) {
    super(eventBus, retryStrategy);
    this.workflowEngine = workflowEngine;
  }
  
  /**
   * 获取资源类型
   */
  protected getResourceKind(): string {
    return 'Workflow';
  }
  
  /**
   * 获取工作流的期望状态
   * @param resource 工作流资源
   */
  async getDesiredState(resource: WorkflowResource): Promise<WorkflowState> {
    // 对于工作流，期望状态取决于工作流定义和当前状态
    // 如果工作流已经执行完成，则期望状态就是当前状态
    const currentState = await this.getCurrentState(resource);
    
    if (
      currentState.status === 'completed' || 
      currentState.status === 'failed' || 
      currentState.status === 'cancelled'
    ) {
      return currentState;
    }
    
    // 否则，期望状态是运行并完成工作流
    return {
      status: 'completed',
      currentStepIndex: resource.spec.steps.length - 1,
      steps: resource.spec.steps.map(step => ({
        name: step.name || 'Unnamed step',
        status: 'completed'
      })),
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * 获取工作流的当前状态
   * @param resource 工作流资源
   */
  async getCurrentState(resource: WorkflowResource): Promise<WorkflowState> {
    try {
      // 使用工作流引擎获取当前状态
      return await this.workflowEngine.getStatus(resource);
    } catch (error) {
      // 如果工作流引擎无法获取状态，尝试从资源状态构建状态对象
      if (!resource.status) {
        // 如果资源没有状态，返回初始状态
        return this.createInitialState(resource);
      }
      
      const status = resource.status as any;
      
      // 从资源状态转换为工作流状态
      const workflowState: WorkflowState = {
        status: mapApiToInternalState(status.phase),
        currentStepIndex: typeof status.currentStep === 'number' ? status.currentStep : 0,
        steps: status.steps?.map((step: any) => ({
          name: step.name,
          status: step.status,
          startTime: step.startTime,
          endTime: step.endTime,
          output: step.output,
          error: step.error
        })) || [],
        startTime: status.startTime,
        endTime: status.endTime,
        context: status.context,
        output: status.output,
        lastUpdated: status.lastTransitionTime || new Date().toISOString()
      };
      
      return workflowState;
    }
  }
  
  /**
   * 更新工作流状态
   * @param resource 工作流资源
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected async updateResourceState(
    resource: WorkflowResource,
    desiredState: WorkflowState,
    currentState: WorkflowState
  ): Promise<void> {
    const resourceId = this.getResourceId(resource);
    
    try {
      // 如果当前工作流未启动，且期望状态不是pending
      if (
        currentState.status === 'pending' && 
        desiredState.status !== 'pending' &&
        !this.runningWorkflows.get(resourceId)
      ) {
        // 标记工作流为运行中
        this.runningWorkflows.set(resourceId, true);
        
        // 更新资源状态
        this.updateResourceStatus(resource, currentState, 'running');
        
        // 发布工作流开始事件
        this.eventBus.publish('workflow.execution.started', {
          resourceId,
          name: resource.metadata.name,
          namespace: resource.metadata.namespace,
          steps: resource.spec.steps.length
        });
        
        // 执行工作流
        try {
          const result = await this.workflowEngine.execute(resource);
          
          // 获取最新状态
          const finalState = await this.workflowEngine.getStatus(resource);
          
          // 更新资源状态
          this.updateResourceStatus(resource, finalState, 'completed', result);
          
          // 发布工作流完成事件
          this.eventBus.publish('workflow.execution.completed', {
            resourceId,
            name: resource.metadata.name,
            namespace: resource.metadata.namespace,
            output: result
          });
        } catch (error) {
          // 获取最新状态
          const failedState = await this.workflowEngine.getStatus(resource);
          
          // 更新资源状态
          this.updateResourceStatus(resource, failedState, 'failed', undefined, error);
          
          // 发布工作流失败事件
          this.eventBus.publish('workflow.execution.failed', {
            resourceId,
            name: resource.metadata.name,
            namespace: resource.metadata.namespace,
            error: (error as Error).message
          });
          
          throw error;
        } finally {
          // 清除运行标记
          this.runningWorkflows.delete(resourceId);
        }
      }
      // 当前工作流已在运行中
      else if (this.runningWorkflows.get(resourceId)) {
        // 工作流引擎已经在处理，不需要在这里做什么
        console.log(`Workflow ${resourceId} is already running`);
      }
      // 工作流已完成或失败，不需要做什么
      else if (
        currentState.status === 'completed' || 
        currentState.status === 'failed' || 
        currentState.status === 'cancelled'
      ) {
        console.log(`Workflow ${resourceId} is already in terminal state: ${currentState.status}`);
      }
      // 异常状态，尝试恢复
      else {
        console.log(`Workflow ${resourceId} is in unexpected state: ${currentState.status}, attempting to recover`);
        
        // 更新资源状态
        this.updateResourceStatus(resource, currentState, currentState.status);
      }
    } catch (error) {
      console.error(`Failed to update workflow ${resourceId}:`, error);
      
      // 更新资源状态
      if (!resource.status) {
        resource.status = {
          phase: 'Failed',
          conditions: []
        };
      }
      
      const status = resource.status as any;
      status.phase = 'Failed';
      status.message = `Failed to update workflow state: ${(error as Error).message}`;
      status.lastTransitionTime = new Date().toISOString();
      
      // 抛出错误以触发错误处理
      throw error;
    }
  }
  
  /**
   * 创建初始工作流状态
   * @param resource 工作流资源
   */
  private createInitialState(resource: WorkflowResource): WorkflowState {
    return {
      status: 'pending',
      currentStepIndex: -1,
      steps: resource.spec.steps.map(step => ({
        name: step.name || 'Unnamed step',
        status: 'pending'
      })),
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * 更新资源状态对象
   * @param resource 工作流资源
   * @param state 工作流状态
   * @param status 状态值
   * @param output 可选的输出结果
   * @param error 可选的错误对象
   */
  private updateResourceStatus(
    resource: WorkflowResource,
    state: WorkflowState,
    status: string,
    output?: any,
    error?: Error
  ): void {
    // 确保资源有状态对象
    if (!resource.status) {
      resource.status = {
        phase: 'Pending',
        conditions: []
      };
    }
    
    const now = new Date().toISOString();
    const resourceStatus = resource.status as any;
    
    // 将内部状态映射为API状态（首字母大写）
    resourceStatus.phase = mapInternalToApiState(status);
    resourceStatus.lastTransitionTime = now;
    resourceStatus.lastExecutionTime = now;
    resourceStatus.currentStep = state.currentStepIndex;
    resourceStatus.steps = state.steps.map(step => ({
      name: step.name,
      status: step.status,
      startTime: step.startTime,
      endTime: step.endTime,
      output: step.output,
      error: step.error
    }));
    resourceStatus.context = state.context;
    
    // 更新输出（如果有）
    if (output !== undefined) {
      resourceStatus.output = output;
    }
    
    // 更新错误信息（如果有）
    if (error) {
      resourceStatus.message = error.message;
      resourceStatus.reason = 'ExecutionFailed';
    }
    
    // 更新开始/结束时间
    if (status === 'running' && !resourceStatus.startTime) {
      resourceStatus.startTime = now;
    }
    
    if (
      (status === 'completed' || status === 'failed' || status === 'cancelled') && 
      !resourceStatus.endTime
    ) {
      resourceStatus.endTime = now;
    }
    
    // 更新资源状态的条件
    if (!resourceStatus.conditions) {
      resourceStatus.conditions = [];
    }
    
    // 获取通用资源状态，用于更新阶段
    const genericStatus = resource.status as ResourceStatus;
    
    // 根据工作流状态确定资源阶段
    let phase: ResourcePhase;
    switch (status) {
      case 'pending':
        phase = ResourcePhase.Pending;
        break;
      case 'running':
        phase = ResourcePhase.Running;
        break;
      case 'completed':
        phase = ResourcePhase.Running; // 完成的工作流仍然是"运行"阶段
        break;
      case 'failed':
        phase = ResourcePhase.Failed;
        break;
      case 'cancelled':
        phase = ResourcePhase.Terminating;
        break;
      default:
        phase = ResourcePhase.Unknown;
    }
    
    // 更新资源阶段
    ResourceStatusManager.updatePhase(
      genericStatus,
      phase,
      error ? 'ExecutionFailed' : status === 'completed' ? 'ExecutionCompleted' : 'ExecutionInProgress',
      error ? error.message : `Workflow execution ${status}`
    );
    
    // 更新执行条件
    ResourceStatusManager.setCondition(
      genericStatus,
      'Execution',
      status === 'running' ? ConditionStatus.True : ConditionStatus.False,
      `Execution${status.charAt(0).toUpperCase() + status.slice(1)}`,
      `Workflow execution is ${status}`
    );
  }
  
  /**
   * 验证工作流资源
   * @param resource 工作流资源
   */
  protected validateResource(resource: WorkflowResource): void {
    // 调用基类验证
    super.validateResource(resource);
    
    // 验证工作流特定字段
    if (!resource.spec.steps || !Array.isArray(resource.spec.steps)) {
      throw new Error('Workflow steps must be an array');
    }
    
    if (resource.spec.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    
    // 验证每个步骤
    resource.spec.steps.forEach((step, index) => {
      if (!step.name) {
        throw new Error(`Step at index ${index} must have a name`);
      }
      
      // 在WorkflowStep中，我们应该检查合法的字段
      if (!this.hasValidAction(step)) {
        throw new Error(`Step "${step.name}" must have a valid action configuration`);
      }
    });
    
    // 验证依赖关系
    this.validateStepConnections(resource.spec.steps);
  }
  
  /**
   * 检查步骤是否具有有效的操作配置
   * 根据types.ts中WorkflowStep的定义调整
   * @param step 工作流步骤
   */
  private hasValidAction(step: WorkflowStep): boolean {
    // 根据WorkflowStep的定义来验证
    // 检查是否有agent字段或者next字段，这些是有效配置的标识
    return !!step.agent || !!step.next || !!step.id;
  }
  
  /**
   * 验证步骤之间的连接关系
   * @param steps 工作流步骤
   */
  private validateStepConnections(steps: WorkflowStep[]): void {
    // 创建步骤名称集合
    const stepNames = new Set(steps.map(step => step.name || step.id || ''));
    
    // 检查每个步骤的next引用是否存在
    steps.forEach(step => {
      if (step.next) {
        if (typeof step.next === 'string') {
          if (!stepNames.has(step.next)) {
            throw new Error(`Step "${step.name || step.id}" references non-existent next step "${step.next}"`);
          }
        } else if (Array.isArray(step.next)) {
          step.next.forEach(nextStep => {
            if (!stepNames.has(nextStep)) {
              throw new Error(`Step "${step.name || step.id}" references non-existent next step "${nextStep}"`);
            }
          });
        }
      }
    });
    
    // 检查是否有循环依赖
    this.checkForCyclicDependencies(steps);
  }
  
  /**
   * 检查是否存在循环依赖
   * @param steps 工作流步骤
   */
  private checkForCyclicDependencies(steps: WorkflowStep[]): void {
    // 创建依赖图
    const dependencyGraph: Record<string, string[]> = {};
    steps.forEach(step => {
      const stepId = step.name || step.id || '';
      let nextSteps: string[] = [];
      
      if (step.next) {
        if (typeof step.next === 'string') {
          nextSteps = [step.next];
        } else if (Array.isArray(step.next)) {
          nextSteps = step.next;
        }
      }
      
      dependencyGraph[stepId] = nextSteps;
    });
    
    // 使用DFS检测循环
    const visited = new Set<string>();
    const pathVisited = new Set<string>();
    
    // 对每个步骤进行DFS
    for (const step of steps) {
      const stepId = step.name || step.id || '';
      if (!visited.has(stepId)) {
        if (this.hasCycle(stepId, dependencyGraph, visited, pathVisited)) {
          throw new Error(`Cyclic dependency detected for step "${stepId}"`);
        }
      }
    }
  }
  
  /**
   * 使用DFS检测图中是否存在循环
   * @param node 当前节点
   * @param graph 依赖图
   * @param visited 已访问节点集合
   * @param pathVisited 当前路径已访问节点集合
   */
  private hasCycle(
    node: string,
    graph: Record<string, string[]>,
    visited: Set<string>,
    pathVisited: Set<string>
  ): boolean {
    visited.add(node);
    pathVisited.add(node);
    
    // 遍历所有依赖
    for (const dep of graph[node] || []) {
      // 如果依赖未访问，递归检查
      if (!visited.has(dep)) {
        if (this.hasCycle(dep, graph, visited, pathVisited)) {
          return true;
        }
      }
      // 如果依赖在当前路径中已访问，存在循环
      else if (pathVisited.has(dep)) {
        return true;
      }
    }
    
    // 回溯，从路径中移除当前节点
    pathVisited.delete(node);
    return false;
  }
  
  /**
   * 解析工作流依赖
   * @param resource 工作流资源
   */
  protected async resolveDependencies(resource: WorkflowResource): Promise<void> {
    // 在这个简单示例中，我们不需要解析外部依赖
    // 在实际实现中，这里可能会检查工作流引用的其他资源
  }
  
  /**
   * 清理工作流资源
   * @param resource 工作流资源
   */
  async cleanupResource(resource: WorkflowResource): Promise<void> {
    const resourceId = this.getResourceId(resource);
    
    try {
      // 如果工作流正在运行，取消执行
      if (this.runningWorkflows.get(resourceId)) {
        await this.workflowEngine.cancel(resource);
        this.runningWorkflows.delete(resourceId);
      }
      
      // 清理工作流相关资源
      console.log(`Cleaning up workflow ${resourceId}`);
      
      // 发布清理事件
      this.eventBus.publish('workflow.cleanup.completed', {
        resourceId,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      });
    } catch (error) {
      console.error(`Failed to cleanup workflow ${resourceId}:`, error);
      throw error;
    }
  }
} 