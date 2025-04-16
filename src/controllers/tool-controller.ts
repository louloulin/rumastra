import { AbstractController } from '../core/controller';
import { EventBus } from '../core/eventbus';
import { ToolResource, Condition } from '../types';

/**
 * Tool控制器
 * 负责管理工具资源的生命周期
 */
export class ToolController extends AbstractController<ToolResource> {
  /**
   * 创建一个新的工具控制器
   * @param eventBus 事件总线
   */
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /**
   * 获取工具资源的期望状态
   * @param resource 工具资源
   * @returns 期望状态
   */
  async getDesiredState(resource: ToolResource): Promise<any> {
    try {
      // 验证工具配置
      this.validateToolConfig(resource);
      
      // 解析执行函数
      const executor = this.resolveExecutor(resource);
      
      // 初始化工具状态
      const state = this.initializeToolState(resource);
      
      return {
        executor,
        state
      };
    } catch (error) {
      console.error(`Failed to get desired state for tool ${this.getResourceId(resource)}:`, error);
      throw error;
    }
  }

  /**
   * 获取工具资源的当前状态
   * @param resource 工具资源
   * @returns 当前状态
   */
  async getCurrentState(resource: ToolResource): Promise<any> {
    try {
      // 简单示例返回当前资源的状态
      return resource.status || {};
    } catch (error) {
      console.error(`Failed to get current state for tool ${this.getResourceId(resource)}:`, error);
      return {}; // 返回空对象表示无状态
    }
  }

  /**
   * 更新工具资源状态
   * @param resource 工具资源
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected async updateResourceState(
    resource: ToolResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    // 更新资源状态
    if (!resource.status) {
      resource.status = {
        phase: 'Ready',
        conditions: []
      };
    }
    
    // 添加或更新Ready条件
    const readyConditionIndex = resource.status.conditions?.findIndex(c => c.type === 'Ready') ?? -1;
    const readyCondition: Condition = {
      type: 'Ready',
      status: 'True',
      reason: 'ToolReady',
      message: 'Tool is ready',
      lastTransitionTime: new Date().toISOString()
    };
    
    if (readyConditionIndex >= 0 && resource.status.conditions) {
      resource.status.conditions[readyConditionIndex] = readyCondition;
    } else if (resource.status.conditions) {
      resource.status.conditions.push(readyCondition);
    } else {
      resource.status.conditions = [readyCondition];
    }
    
    // 确保状态设置为 Ready 以符合类型定义和测试预期
    resource.status.phase = 'Ready';
    
    // 发布工具就绪事件
    this.eventBus.publish('tool.reconciled', {
      resource,
      state: desiredState.state
    });
  }

  /**
   * 清理工具资源
   * @param resource 工具资源
   */
  protected async cleanupResource(resource: ToolResource): Promise<void> {
    try {
      const toolId = this.getResourceId(resource);
      
      // 发布清理事件
      this.eventBus.publish('tool.cleaned', {
        resource,
        toolId
      });
    } catch (error) {
      console.error(`Failed to cleanup tool ${this.getResourceId(resource)}:`, error);
    }
  }

  /**
   * 验证工具配置
   * @param resource 工具资源
   */
  private validateToolConfig(resource: ToolResource): void {
    const { id, description, execute } = resource.spec;
    
    // 必须有ID
    if (!id) {
      throw new Error(`Tool resource must have an id`);
    }
    
    // 必须有描述
    if (!description) {
      throw new Error(`Tool ${id} must have a description`);
    }
    
    // 必须有执行函数
    if (!execute) {
      throw new Error(`Tool ${id} must have an execute function path`);
    }
  }

  /**
   * 解析执行函数路径
   * @param resource 工具资源
   * @returns 执行函数解析结果
   */
  private resolveExecutor(resource: ToolResource): any {
    // 简单实现：返回执行函数路径
    return {
      path: resource.spec.execute,
      resolved: true
    };
  }

  /**
   * 初始化工具状态
   * @param resource 工具资源
   * @returns 初始工具状态
   */
  private initializeToolState(resource: ToolResource): Record<string, any> {
    // 创建初始工具状态
    return {
      toolId: this.getResourceId(resource),
      createdAt: new Date().toISOString(),
      id: resource.spec.id,
      description: resource.spec.description,
      hasInputSchema: !!resource.spec.inputSchema,
      hasOutputSchema: !!resource.spec.outputSchema
    };
  }
} 