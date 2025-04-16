import { AbstractController } from '../controller';
import { EventBus } from '../eventbus';
import { LLMResource } from '../../types';
import { createModelFromConfig } from './converter';

/**
 * LLM控制器 - 管理LLM资源
 */
export class LLMController extends AbstractController<LLMResource> {
  private modelCache: Map<string, any> = new Map();
  
  constructor(eventBus: EventBus) {
    super(eventBus);
  }
  
  /**
   * 获取期望状态
   */
  async getDesiredState(resource: LLMResource): Promise<any> {
    // 处理环境变量引用等
    const processedSpec = this.processSpecValues(resource.spec);
    
    return {
      ...resource,
      spec: processedSpec,
      status: {
        phase: 'Ready',
        lastProbeTime: new Date().toISOString(),
        conditions: [
          {
            type: 'Available',
            status: 'True',
            reason: 'ModelReady',
            message: 'Model is ready for use',
            lastTransitionTime: new Date().toISOString(),
          }
        ]
      }
    };
  }
  
  /**
   * 获取当前状态
   */
  async getCurrentState(resource: LLMResource): Promise<any> {
    // 获取当前状态
    return resource;
  }
  
  /**
   * 更新资源状态
   */
  protected async updateResourceState(
    resource: LLMResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    try {
      // 创建模型实例并缓存
      const model = await createModelFromConfig(desiredState.spec);
      this.modelCache.set(this.getResourceId(resource), model);
      
      // 更新资源状态
      resource.status = desiredState.status;
      
      // 发布事件通知模型已准备就绪
      this.eventBus.publish(`llm.ready`, { 
        resource, 
        state: desiredState,
        model
      });
    } catch (error) {
      // 处理错误
      await this.handleModelCreationFailure(resource, error);
    }
  }
  
  /**
   * 清理资源
   */
  protected async cleanupResource(resource: LLMResource): Promise<void> {
    const resourceId = this.getResourceId(resource);
    
    // 从缓存中删除模型实例
    this.modelCache.delete(resourceId);
    
    // 发布清理事件
    this.eventBus.publish(`llm.cleaned`, { 
      resource,
      resourceId 
    });
  }
  
  /**
   * 获取LLM模型实例
   */
  getModel(resourceId: string): any {
    const model = this.modelCache.get(resourceId);
    if (!model) {
      throw new Error(`LLM model not found: ${resourceId}`);
    }
    return model;
  }
  
  /**
   * 处理模型创建失败
   */
  private async handleModelCreationFailure(resource: LLMResource, error: any): Promise<void> {
    // 更新资源状态为失败
    resource.status = {
      phase: 'Failed',
      lastProbeTime: new Date().toISOString(),
      conditions: [
        {
          type: 'Available',
          status: 'False',
          reason: 'ModelCreationFailed',
          message: error.message || 'Failed to create model',
          lastTransitionTime: new Date().toISOString(),
        }
      ]
    };
    
    // 发布失败事件
    this.eventBus.publish(`llm.failed`, { 
      resource, 
      error: error.message || 'Unknown error' 
    });
  }
  
  /**
   * 处理配置中的环境变量引用和其他值转换
   */
  private processSpecValues(spec: any): any {
    const processValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envName = value.slice(2, -1);
        return process.env[envName] || value;
      }
      
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map(item => processValue(item));
        } else {
          return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, processValue(v)])
          );
        }
      }
      
      return value;
    };
    
    return processValue(spec);
  }
} 