import { EventBus } from '../eventbus';
import { ResourceScheduler } from '../scheduler/resource-scheduler';
import { AbstractController } from '../controller';
import { AgentResource, Condition } from '../../types';

export interface AgentControllerEvents {
  'agent.created': { agentId: string };
  'agent.updated': { agentId: string };
  'agent.deleted': { agentId: string };
  'agent.failed': { agentId: string; error: Error };
}

export interface AgentInstance {
  id: string;
  name: string;
  namespace: string;
  spec: AgentResource['spec'];
  isReady: boolean;
  isFailed: boolean;
  error?: Error;
  lastExecutionTime?: string;
}

/**
 * Agent控制器
 * 负责Agent资源的生命周期管理
 */
export class AgentController extends AbstractController<AgentResource> {
  private agentInstances: Map<string, AgentInstance> = new Map();
  
  constructor(eventBus: EventBus) {
    super(eventBus);
  }
  
  /**
   * 获取Agent的期望状态
   */
  public async getDesiredState(resource: AgentResource): Promise<any> {
    this.validateAgentResource(resource);
    return {
      phase: 'Running',
      spec: resource.spec
    };
  }
  
  /**
   * 获取Agent的当前状态
   */
  public async getCurrentState(resource: AgentResource): Promise<any> {
    const agentId = this.getAgentId(resource);
    const instance = this.agentInstances.get(agentId);

    if (!instance) {
      return {
        phase: 'Pending',
        spec: resource.spec
      };
    }

    return {
      phase: instance.isFailed ? 'Failed' : (instance.isReady ? 'Running' : 'Pending'),
      spec: instance.spec,
      error: instance.error?.message,
      lastExecutionTime: instance.lastExecutionTime
    };
  }
  
  /**
   * 更新Agent状态
   */
  protected async updateResourceState(
    resource: AgentResource,
    desiredState: any,
    currentState: any
  ): Promise<void> {
    const agentId = this.getAgentId(resource);

    // 如果当前状态是Failed，需要重置状态
    if (currentState.phase === 'Failed') {
      await this.deleteAgent(agentId);
    }

    // 如果Agent不存在或需要更新，创建/更新Agent
    if (!this.agentInstances.has(agentId) || 
        JSON.stringify(currentState.spec) !== JSON.stringify(desiredState.spec)) {
      await this.createOrUpdateAgent(resource);
    }
  }
  
  /**
   * 处理协调失败
   */
  protected async handleReconcileFailure(resource: AgentResource, error: Error): Promise<void> {
    // 确保状态对象存在
    if (!resource.status) {
      resource.status = {
        phase: 'Failed'
      };
    } else {
      resource.status.phase = 'Failed';
    }
    
    // 添加条件
    if (!resource.status.conditions) {
      resource.status.conditions = [];
    }
    
    // 添加错误条件
    const failureCondition: Condition = {
      type: 'Reconciliation',
      status: 'False',
      reason: 'ReconciliationFailed',
      message: error.message,
      lastTransitionTime: new Date().toISOString()
    };
    
    // 添加或更新条件
    const existingConditionIndex = resource.status.conditions.findIndex(c => c.type === 'Reconciliation');
    if (existingConditionIndex >= 0) {
      resource.status.conditions[existingConditionIndex] = failureCondition;
    } else {
      resource.status.conditions.push(failureCondition);
    }
    
    // 更新最后执行时间
    resource.status.lastExecutionTime = new Date().toISOString();
    
    // 发布失败事件
    this.eventBus.emit('agent.failed', { agentId: this.getAgentId(resource), error });
  }
  
  /**
   * 创建Agent实例
   */
  private async createOrUpdateAgent(resource: AgentResource): Promise<void> {
    const agentId = this.getAgentId(resource);

    try {
      // 创建Agent实例
      const instance: AgentInstance = {
        id: agentId,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace || 'default',
        spec: resource.spec,
        isReady: false,
        isFailed: false
      };

      // 初始化Agent
      await this.initializeAgent(instance);

      // 更新实例状态
      instance.isReady = true;
      instance.lastExecutionTime = new Date().toISOString();

      // 保存实例
      this.agentInstances.set(agentId, instance);

      // 发送事件
      this.eventBus.emit(
        this.agentInstances.has(agentId) ? 'agent.updated' : 'agent.created',
        { agentId }
      );
    } catch (error) {
      // 更新失败状态
      const instance = this.agentInstances.get(agentId);
      if (instance) {
        instance.isFailed = true;
        instance.error = error as Error;
        this.agentInstances.set(agentId, instance);
      }

      // 发送失败事件
      this.eventBus.emit('agent.failed', {
        agentId,
        error: error as Error
      });

      throw error;
    }
  }
  
  /**
   * 删除Agent实例
   */
  private async deleteAgent(agentId: string): Promise<void> {
    const instance = this.agentInstances.get(agentId);
    if (instance) {
      try {
        // 清理Agent资源
        await this.cleanupAgent(instance);

        // 移除实例
        this.agentInstances.delete(agentId);

        // 发送删除事件
        this.eventBus.emit('agent.deleted', { agentId });
      } catch (error) {
        console.error(`Failed to delete agent ${agentId}:`, error);
        throw error;
      }
    }
  }
  
  /**
   * 获取Agent ID
   */
  private getAgentId(resource: AgentResource): string {
    return `${resource.metadata.namespace || 'default'}/${resource.metadata.name}`;
  }
  
  /**
   * 验证Agent资源
   */
  private validateAgentResource(resource: AgentResource): void {
    if (!resource.metadata?.name) {
      throw new Error('Agent resource must have a name');
    }
    
    if (!resource.spec) {
      throw new Error('Agent resource must have a spec');
    }
  }
  
  /**
   * 初始化Agent
   */
  private async initializeAgent(instance: AgentInstance): Promise<void> {
    // 这里可以添加Agent初始化逻辑
    // 例如：加载模型、初始化工具等
    console.log(`Initializing agent ${instance.name}`);
  }
  
  /**
   * 清理Agent资源
   */
  private async cleanupAgent(instance: AgentInstance): Promise<void> {
    // 这里可以添加Agent清理逻辑
    // 例如：释放资源、关闭连接等
    console.log(`Cleaning up agent ${instance.name}`);
  }
  
  /**
   * 清理资源
   */
  protected async cleanupResource(resource: AgentResource): Promise<void> {
    const agentId = this.getAgentId(resource);
    await this.deleteAgent(agentId);
  }
} 