/**
 * 资源状态生命周期枚举
 * 定义了资源在生命周期中可能处于的各种状态
 */
export enum ResourcePhase {
  /** 资源被创建但尚未完全初始化 */
  Pending = 'Pending',
  
  /** 资源初始化中，正在解析依赖和配置 */
  Initializing = 'Initializing',
  
  /** 资源正常运行中 */
  Running = 'Running',
  
  /** 资源部分功能受限或性能下降 */
  Degraded = 'Degraded',
  
  /** 资源处于错误状态，无法正常工作 */
  Failed = 'Failed',
  
  /** 资源正在被终止或删除 */
  Terminating = 'Terminating',
  
  /** 无法确定资源的当前状态 */
  Unknown = 'Unknown'
}

/**
 * 资源状态条件类型枚举
 * 描述资源的特定条件类型
 */
export enum ConditionType {
  /** 资源是否可用 */
  Ready = 'Ready',
  
  /** 资源是否可接受请求 */
  Available = 'Available',
  
  /** 资源是否正在初始化 */
  Initializing = 'Initializing',
  
  /** 资源是否正在进行协调 */
  Reconciling = 'Reconciling',
  
  /** 资源是否处于降级状态 */
  Degraded = 'Degraded',
  
  /** 资源是否存在错误 */
  Error = 'Error',
  
  /** 资源是否正在被终止 */
  Terminating = 'Terminating'
}

/**
 * 状态条件的值枚举
 */
export enum ConditionStatus {
  /** 条件为真 */
  True = 'True',
  
  /** 条件为假 */
  False = 'False',
  
  /** 条件未知 */
  Unknown = 'Unknown'
}

/**
 * 资源状态条件接口
 * 描述资源的特定状态条件
 */
export interface ResourceCondition {
  /** 条件类型 */
  type: string;
  
  /** 条件状态 */
  status: ConditionStatus;
  
  /** 原因 */
  reason?: string;
  
  /** 消息 */
  message?: string;
  
  /** 上次转换时间 */
  lastTransitionTime: string;
  
  /** 上次更新时间 */
  lastUpdateTime?: string;
  
  /** 上次探测时间 */
  lastProbeTime?: string;
}

/**
 * 资源状态接口
 * 描述资源的完整状态
 */
export interface ResourceStatus {
  /** 当前阶段 */
  phase: ResourcePhase;
  
  /** 状态条件列表 */
  conditions: ResourceCondition[];
  
  /** 观察到的资源版本 */
  observedGeneration?: number;
  
  /** 上次状态转换时间 */
  lastTransitionTime?: string;
  
  /** 创建时间 */
  creationTime?: string;
  
  /** 上次成功时间 */
  lastSuccessTime?: string;
  
  /** 上次失败时间 */
  lastFailureTime?: string;
  
  /** 详细信息对象 */
  details?: Record<string, any>;
}

/**
 * 状态转换事件接口
 * 描述状态转换事件
 */
export interface StatusTransitionEvent {
  /** 资源类型 */
  kind: string;
  
  /** 资源名称 */
  name: string;
  
  /** 资源命名空间 */
  namespace?: string;
  
  /** 上一个状态 */
  previousPhase: ResourcePhase;
  
  /** 当前状态 */
  currentPhase: ResourcePhase;
  
  /** 转换时间 */
  transitionTime: string;
  
  /** 转换原因 */
  reason?: string;
  
  /** 转换消息 */
  message?: string;
}

/**
 * 资源状态管理器类
 * 负责管理资源状态的转换和验证
 */
export class ResourceStatusManager {
  /**
   * 创建一个新的状态对象
   */
  public static createStatus(phase: ResourcePhase = ResourcePhase.Pending): ResourceStatus {
    return {
      phase,
      conditions: [],
      creationTime: new Date().toISOString()
    };
  }
  
  /**
   * 获取条件
   */
  public static getCondition(
    status: ResourceStatus, 
    conditionType: string
  ): ResourceCondition | undefined {
    if (!status.conditions) {
      return undefined;
    }
    
    return status.conditions.find(condition => condition.type === conditionType);
  }
  
  /**
   * 设置条件
   */
  public static setCondition(
    status: ResourceStatus,
    type: string,
    newStatus: ConditionStatus,
    reason?: string,
    message?: string
  ): ResourceStatus {
    // 确保条件数组存在
    if (!status.conditions) {
      status.conditions = [];
    }
    
    // 查找现有条件
    const now = new Date().toISOString();
    const existingCondition = status.conditions.find(c => c.type === type);
    
    if (existingCondition) {
      // 如果条件状态已更改，更新转换时间
      if (existingCondition.status !== newStatus) {
        existingCondition.lastTransitionTime = now;
      }
      
      // 更新条件内容
      existingCondition.status = newStatus;
      existingCondition.reason = reason;
      existingCondition.message = message;
      existingCondition.lastUpdateTime = now;
    } else {
      // 创建新条件
      const newCondition: ResourceCondition = {
        type,
        status: newStatus,
        reason,
        message,
        lastTransitionTime: now,
        lastUpdateTime: now
      };
      
      // 添加到条件数组
      status.conditions.push(newCondition);
    }
    
    return status;
  }
  
  /**
   * 更新资源状态阶段
   */
  public static updatePhase(
    status: ResourceStatus,
    newPhase: ResourcePhase,
    reason?: string,
    message?: string
  ): StatusTransitionEvent | null {
    // 如果状态没有改变，返回null
    if (status.phase === newPhase) {
      return null;
    }
    
    // 保存旧状态
    const previousPhase = status.phase;
    
    // 验证状态转换合法性
    if (!this.isValidTransition(previousPhase, newPhase)) {
      throw new Error(
        `Invalid state transition from ${previousPhase} to ${newPhase}. Reason: ${reason || 'Unknown'}`
      );
    }
    
    // 记录转换时间
    const now = new Date().toISOString();
    
    // 更新状态
    status.phase = newPhase;
    status.lastTransitionTime = now;
    
    // 根据新状态更新相关条件
    switch (newPhase) {
      case ResourcePhase.Running:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.True, 'ResourceRunning', message);
        this.setCondition(status, ConditionType.Available, ConditionStatus.True, 'ResourceAvailable', message);
        status.lastSuccessTime = now;
        break;
        
      case ResourcePhase.Failed:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.False, 'ResourceFailed', message);
        this.setCondition(status, ConditionType.Error, ConditionStatus.True, reason, message);
        status.lastFailureTime = now;
        break;
        
      case ResourcePhase.Degraded:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.True, 'ResourceDegraded', message);
        this.setCondition(status, ConditionType.Degraded, ConditionStatus.True, reason, message);
        break;
        
      case ResourcePhase.Initializing:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.False, 'ResourceInitializing', message);
        this.setCondition(status, ConditionType.Initializing, ConditionStatus.True, reason, message);
        break;
        
      case ResourcePhase.Terminating:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.False, 'ResourceTerminating', message);
        this.setCondition(status, ConditionType.Terminating, ConditionStatus.True, reason, message);
        break;
        
      case ResourcePhase.Pending:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.False, 'ResourcePending', message);
        break;
        
      case ResourcePhase.Unknown:
        this.setCondition(status, ConditionType.Ready, ConditionStatus.Unknown, 'ResourceStateUnknown', message);
        break;
    }
    
    // 创建并返回状态转换事件
    return {
      kind: 'Unknown', // 调用者应更新此字段
      name: 'Unknown', // 调用者应更新此字段
      previousPhase,
      currentPhase: newPhase,
      transitionTime: now,
      reason,
      message
    };
  }
  
  /**
   * 验证状态转换是否合法
   */
  private static isValidTransition(fromPhase: ResourcePhase, toPhase: ResourcePhase): boolean {
    // 定义允许的状态转换
    const validTransitions: Record<ResourcePhase, ResourcePhase[]> = {
      [ResourcePhase.Pending]: [
        ResourcePhase.Initializing, 
        ResourcePhase.Failed, 
        ResourcePhase.Terminating,
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Initializing]: [
        ResourcePhase.Running, 
        ResourcePhase.Failed, 
        ResourcePhase.Terminating,
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Running]: [
        ResourcePhase.Degraded, 
        ResourcePhase.Failed, 
        ResourcePhase.Terminating,
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Degraded]: [
        ResourcePhase.Running, 
        ResourcePhase.Failed, 
        ResourcePhase.Terminating,
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Failed]: [
        ResourcePhase.Initializing, 
        ResourcePhase.Terminating,
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Terminating]: [
        ResourcePhase.Unknown
      ],
      [ResourcePhase.Unknown]: [
        ResourcePhase.Pending,
        ResourcePhase.Initializing,
        ResourcePhase.Running,
        ResourcePhase.Degraded,
        ResourcePhase.Failed,
        ResourcePhase.Terminating
      ]
    };
    
    // 任何状态都可以转换到Unknown
    if (toPhase === ResourcePhase.Unknown) {
      return true;
    }
    
    // 检查转换是否在允许列表中
    return validTransitions[fromPhase]?.includes(toPhase) || false;
  }
} 