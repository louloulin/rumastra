import { describe, it, expect, vi } from 'vitest';
import { 
  ResourcePhase, 
  ConditionType, 
  ConditionStatus, 
  ResourceStatusManager
} from '../src/core/state/resource-status';

describe('ResourceStatusManager', () => {
  describe('createStatus', () => {
    it('should create a new status with defaults', () => {
      const status = ResourceStatusManager.createStatus();
      
      expect(status.phase).toBe(ResourcePhase.Pending);
      expect(status.conditions).toEqual([]);
      expect(status.creationTime).toBeDefined();
    });
    
    it('should create a status with specified phase', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Running);
      
      expect(status.phase).toBe(ResourcePhase.Running);
    });
  });
  
  describe('setCondition', () => {
    it('should add a new condition if not exists', () => {
      const status = ResourceStatusManager.createStatus();
      
      ResourceStatusManager.setCondition(
        status, 
        ConditionType.Ready, 
        ConditionStatus.True, 
        'TestReason', 
        'Test message'
      );
      
      expect(status.conditions.length).toBe(1);
      expect(status.conditions[0].type).toBe(ConditionType.Ready);
      expect(status.conditions[0].status).toBe(ConditionStatus.True);
      expect(status.conditions[0].reason).toBe('TestReason');
      expect(status.conditions[0].message).toBe('Test message');
      expect(status.conditions[0].lastTransitionTime).toBeDefined();
      expect(status.conditions[0].lastUpdateTime).toBeDefined();
    });
    
    it('should update an existing condition', () => {
      const status = ResourceStatusManager.createStatus();
      
      // 添加初始条件
      ResourceStatusManager.setCondition(
        status, 
        ConditionType.Ready, 
        ConditionStatus.False, 
        'InitialReason', 
        'Initial message'
      );
      
      // 保存初始转换时间
      const initialTransitionTime = status.conditions[0].lastTransitionTime;
      
      // 等待一秒以确保时间戳不同
      vi.advanceTimersByTime(1000);
      
      // 更新条件，状态改变
      ResourceStatusManager.setCondition(
        status, 
        ConditionType.Ready, 
        ConditionStatus.True, 
        'UpdatedReason', 
        'Updated message'
      );
      
      expect(status.conditions.length).toBe(1);
      expect(status.conditions[0].status).toBe(ConditionStatus.True);
      expect(status.conditions[0].reason).toBe('UpdatedReason');
      expect(status.conditions[0].message).toBe('Updated message');
      expect(status.conditions[0].lastTransitionTime).not.toBe(initialTransitionTime);
    });
  });
  
  describe('getCondition', () => {
    it('should return undefined if condition does not exist', () => {
      const status = ResourceStatusManager.createStatus();
      
      const condition = ResourceStatusManager.getCondition(status, ConditionType.Ready);
      
      expect(condition).toBeUndefined();
    });
    
    it('should return condition if it exists', () => {
      const status = ResourceStatusManager.createStatus();
      
      ResourceStatusManager.setCondition(
        status, 
        ConditionType.Ready, 
        ConditionStatus.True, 
        'TestReason', 
        'Test message'
      );
      
      const condition = ResourceStatusManager.getCondition(status, ConditionType.Ready);
      
      expect(condition).toBeDefined();
      expect(condition?.type).toBe(ConditionType.Ready);
      expect(condition?.status).toBe(ConditionStatus.True);
    });
  });
  
  describe('updatePhase', () => {
    it('should update phase and return transition event', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Pending);
      
      const event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Initializing,
        'InitializingResource',
        'Resource is initializing'
      );
      
      expect(status.phase).toBe(ResourcePhase.Initializing);
      expect(status.lastTransitionTime).toBeDefined();
      
      expect(event).toBeDefined();
      expect(event?.previousPhase).toBe(ResourcePhase.Pending);
      expect(event?.currentPhase).toBe(ResourcePhase.Initializing);
      expect(event?.reason).toBe('InitializingResource');
    });
    
    it('should return null if phase has not changed', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Running);
      
      const event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Running,
        'StillRunning',
        'Resource is still running'
      );
      
      expect(event).toBeNull();
    });
    
    it('should update conditions based on phase', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Pending);
      
      ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Running,
        'ResourceStarted',
        'Resource has started running'
      );
      
      const readyCondition = ResourceStatusManager.getCondition(status, ConditionType.Ready);
      const availableCondition = ResourceStatusManager.getCondition(status, ConditionType.Available);
      
      expect(readyCondition?.status).toBe(ConditionStatus.True);
      expect(availableCondition?.status).toBe(ConditionStatus.True);
      expect(status.lastSuccessTime).toBeDefined();
    });
    
    it('should throw error for invalid transitions', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Terminating);
      
      expect(() => {
        ResourceStatusManager.updatePhase(
          status,
          ResourcePhase.Running,
          'InvalidTransition',
          'Cannot go from Terminating to Running'
        );
      }).toThrow(/Invalid state transition/);
    });
    
    it('should allow transition to Unknown from any state', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Terminating);
      
      const event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Unknown,
        'LostConnection',
        'Lost connection to resource'
      );
      
      expect(status.phase).toBe(ResourcePhase.Unknown);
      expect(event).not.toBeNull();
    });
  });
  
  describe('state transitions', () => {
    it('should follow valid transition path: Pending -> Initializing -> Running -> Degraded -> Running', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Pending);
      
      // Pending -> Initializing
      let event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Initializing,
        'Initializing',
        'Resource is initializing'
      );
      expect(status.phase).toBe(ResourcePhase.Initializing);
      expect(event).not.toBeNull();
      
      // Initializing -> Running
      event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Running,
        'Started',
        'Resource has started'
      );
      expect(status.phase).toBe(ResourcePhase.Running);
      expect(event).not.toBeNull();
      
      // Running -> Degraded
      event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Degraded,
        'PerformanceIssue',
        'Resource is experiencing performance issues'
      );
      expect(status.phase).toBe(ResourcePhase.Degraded);
      expect(event).not.toBeNull();
      
      // Degraded -> Running
      event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Running,
        'Recovered',
        'Resource has recovered'
      );
      expect(status.phase).toBe(ResourcePhase.Running);
      expect(event).not.toBeNull();
    });
    
    it('should handle error recovery: Running -> Failed -> Initializing -> Running', () => {
      const status = ResourceStatusManager.createStatus(ResourcePhase.Running);
      
      // Running -> Failed
      let event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Failed,
        'CriticalError',
        'Resource encountered a critical error'
      );
      expect(status.phase).toBe(ResourcePhase.Failed);
      expect(event).not.toBeNull();
      
      // Failed -> Initializing
      event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Initializing,
        'Recovering',
        'Attempting to recover resource'
      );
      expect(status.phase).toBe(ResourcePhase.Initializing);
      expect(event).not.toBeNull();
      
      // Initializing -> Running
      event = ResourceStatusManager.updatePhase(
        status,
        ResourcePhase.Running,
        'Recovered',
        'Resource has recovered and is running'
      );
      expect(status.phase).toBe(ResourcePhase.Running);
      expect(event).not.toBeNull();
    });
  });
}); 