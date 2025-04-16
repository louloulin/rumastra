import { AbstractController } from '../controller';
import { EventBus } from '../eventbus';
import { NetworkResource, Condition } from '../../types';
import { NetworkState } from './state';
import { NetworkStateStore } from './store';

/**
 * Network控制器
 * 负责管理网络资源的生命周期
 */
export class NetworkController extends AbstractController<NetworkResource> {
  private stateStore: NetworkStateStore;
  
  /**
   * 创建一个新的网络控制器
   * @param eventBus 事件总线
   * @param stateStore 网络状态存储
   */
  constructor(eventBus: EventBus, stateStore: NetworkStateStore) {
    super(eventBus);
    this.stateStore = stateStore;
  }

  /**
   * 验证网络资源配置
   * @param resource 要验证的网络资源
   * @throws 如果验证失败则抛出错误
   */
  async validateResource(resource: NetworkResource): Promise<void> {
    if (!resource.spec) {
      throw new Error('Network resource must have a spec');
    }

    // 验证路由器配置
    if (!resource.spec.router) {
      throw new Error('Network must have a router configuration');
    }

    if (!resource.spec.router.model || !resource.spec.router.model.provider || !resource.spec.router.model.name) {
      throw new Error('Router must have a valid model configuration');
    }

    // 验证代理配置
    if (!resource.spec.agents || !Array.isArray(resource.spec.agents) || resource.spec.agents.length === 0) {
      throw new Error('Network must have at least one agent');
    }

    // 验证每个代理配置
    for (const agent of resource.spec.agents) {
      if (!agent.name) {
        throw new Error('Each agent must have a name');
      }
      if (!agent.ref) {
        throw new Error(`Agent ${agent.name} must have a reference`);
      }
    }

    // 验证元数据
    if (!resource.metadata || !resource.metadata.name) {
      throw new Error('Network resource must have metadata with a name');
    }
  }

  /**
   * 获取网络资源的期望状态
   * @param resource 网络资源
   * @returns 期望状态
   */
  async getDesiredState(resource: NetworkResource): Promise<any> {
    try {
      // 解析代理引用
      const agentRefs = await this.resolveAgentReferences(resource);
      
      // 配置路由器
      const router = this.configureRouter(resource);
      
      // 初始化网络状态
      const state = this.initializeNetworkState(resource);
      
      return {
        agents: agentRefs,
        router,
        state
      };
    } catch (error) {
      console.error(`Failed to get desired state for network ${this.getResourceId(resource)}:`, error);
      throw error;
    }
  }

  /**
   * 获取网络资源的当前状态
   * @param resource 网络资源
   * @returns 当前状态
   */
  async getCurrentState(resource: NetworkResource): Promise<any> {
    try {
      const networkId = this.getResourceId(resource);
      const state = await this.stateStore.getNetworkState(networkId);
      return state;
    } catch (error) {
      console.error(`Failed to get current state for network ${this.getResourceId(resource)}:`, error);
      return {}; // 返回空对象表示无状态
    }
  }

  /**
   * 更新网络资源状态
   * @param resource 网络资源
   * @param desiredState 期望状态
   * @param currentState 当前状态
   */
  protected async updateResourceState(
    resource: NetworkResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    // 更新网络状态
    const networkId = this.getResourceId(resource);
    await this.stateStore.updateNetworkState(networkId, desiredState.state);
    
    // 更新资源状态
    if (!resource.status) {
      resource.status = {
        phase: 'Running',
        conditions: [],
        stepCount: 0
      };
    } else {
      resource.status.phase = 'Running';
      
      // 添加或更新Ready条件
      const readyConditionIndex = resource.status.conditions?.findIndex(c => c.type === 'Ready') ?? -1;
      const readyCondition: Condition = {
        type: 'Ready',
        status: 'True',
        reason: 'NetworkReady',
        message: 'Network is ready',
        lastTransitionTime: new Date().toISOString()
      };
      
      if (readyConditionIndex >= 0 && resource.status.conditions) {
        resource.status.conditions[readyConditionIndex] = readyCondition;
      } else if (resource.status.conditions) {
        resource.status.conditions.push(readyCondition);
      } else {
        resource.status.conditions = [readyCondition];
      }
    }
  }

  /**
   * 清理网络资源
   * @param resource 网络资源
   */
  public async cleanupResource(resource: NetworkResource): Promise<void> {
    try {
      const networkId = this.getResourceId(resource);
      await this.stateStore.deleteNetworkState(networkId);
      
      // 发布清理事件
      this.eventBus.publish('network.cleaned', {
        resource,
        networkId
      });
    } catch (error) {
      console.error(`Failed to cleanup network ${this.getResourceId(resource)}:`, error);
    }
  }

  /**
   * 解析代理引用
   * @param resource 网络资源
   * @returns 解析后的代理引用数组
   */
  private async resolveAgentReferences(resource: NetworkResource): Promise<any[]> {
    const resolvedAgents = [];
    
    for (const agent of resource.spec.agents) {
      try {
        // 解析代理引用
        // 这里应该调用RuntimeManager的resolveAgentReference方法
        // 暂时返回带有标记的引用对象
        const resolved = {
          name: agent.name,
          ref: agent.ref,
          resolved: true,
          config: {
            ...agent,
            resolvedAt: new Date().toISOString()
          }
        };
        
        resolvedAgents.push(resolved);
      } catch (error) {
        console.error(`Failed to resolve agent reference ${agent.ref}:`, error);
        throw new Error(`Failed to resolve agent reference: ${agent.ref}`);
      }
    }
    
    return resolvedAgents;
  }

  /**
   * 配置路由器
   * @param resource 网络资源
   * @returns 路由器配置
   */
  private configureRouter(resource: NetworkResource): any {
    if (!resource.spec.router) {
      throw new Error('Router configuration is required');
    }

    return {
      model: resource.spec.router.model,
      maxSteps: resource.spec.router.maxSteps || 10,
      configured: true,
      config: {
        ...resource.spec.router,
        configuredAt: new Date().toISOString()
      }
    };
  }

  /**
   * 初始化网络状态
   * @param resource 网络资源
   * @returns 初始网络状态
   */
  private initializeNetworkState(resource: NetworkResource): Record<string, any> {
    const state = new NetworkState();
    
    // 添加基本信息
    state.set('networkId', this.getResourceId(resource));
    state.set('createdAt', new Date().toISOString());
    state.set('instructions', resource.spec.instructions || '');
    state.set('agentCount', resource.spec.agents.length);
    
    // 添加路由器信息
    state.set('router', {
      provider: resource.spec.router.model.provider,
      model: resource.spec.router.model.name,
      maxSteps: resource.spec.router.maxSteps || 10
    });
    
    // 添加代理信息
    state.set('agents', resource.spec.agents.map(agent => ({
      name: agent.name,
      ref: agent.ref
    })));
    
    // 添加执行统计
    state.set('stats', {
      totalExecutions: 0,
      lastExecutionTime: null,
      averageStepCount: 0
    });
    
    return state.toObject();
  }

  /**
   * 更新网络状态
   * @param networkId 网络ID
   * @param updates 状态更新
   */
  private async updateNetworkStats(networkId: string, updates: any): Promise<void> {
    try {
      const currentState = await this.stateStore.getNetworkState(networkId);
      const stats = currentState.stats || {
        totalExecutions: 0,
        lastExecutionTime: null,
        averageStepCount: 0
      };
      
      // 更新统计信息
      stats.totalExecutions++;
      stats.lastExecutionTime = new Date().toISOString();
      
      if (updates.stepCount) {
        stats.averageStepCount = (stats.averageStepCount * (stats.totalExecutions - 1) + updates.stepCount) / stats.totalExecutions;
      }
      
      await this.stateStore.updateNetworkState(networkId, {
        ...currentState,
        stats
      });
    } catch (error) {
      console.error(`Failed to update network stats for ${networkId}:`, error);
    }
  }
} 