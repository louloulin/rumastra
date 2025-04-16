import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/core/eventbus';
import { AgentController } from '../src/core/agent/controller';
import { createAgentResource } from '../src/types';

describe('Agent Controller 测试', () => {
  // 测试数据
  let eventBus: EventBus;
  let controller: AgentController;
  let agentResource: any;

  beforeEach(() => {
    // 创建事件总线和控制器
    eventBus = new EventBus();
    controller = new AgentController(eventBus);
    
    // 创建模拟的代理资源
    agentResource = createAgentResource('test-agent', {
      name: 'test-agent',
      instructions: '我是一个测试代理',
      model: {
        provider: 'openai',
        name: 'gpt-4'
      },
      tools: { tool1: 'tool1-ref', tool2: 'tool2-ref' }
    });
  });

  describe('代理资源管理', () => {
    it('应该能够监视代理资源', () => {
      // 监听事件
      const spyPublish = vi.spyOn(eventBus, 'publish');
      
      // 监视代理资源
      controller.watch(agentResource);
      
      // 验证事件发布
      expect(spyPublish).toHaveBeenCalled();
    });
    
    it('应该能够协调代理资源', async () => {
      // 监听事件
      const spyPublish = vi.spyOn(eventBus, 'publish');
      
      // 获取期望状态的间谍
      const spyGetDesiredState = vi.spyOn(controller, 'getDesiredState');
      
      // 协调代理资源
      await controller.reconcile(agentResource);
      
      // 验证方法调用
      expect(spyGetDesiredState).toHaveBeenCalledWith(agentResource);
      
      // 验证事件发布
      expect(spyPublish).toHaveBeenCalledWith('agent.reconciled', expect.any(Object));
      
      // 验证代理状态
      expect(agentResource.status).toBeDefined();
      expect(agentResource.status.phase).toBe('Running');
    });
  });

  describe('代理生命周期', () => {
    it('应该能够处理代理创建', async () => {
      // 监听代理就绪事件
      const onReconciled = vi.fn();
      eventBus.subscribe('agent.reconciled', onReconciled);
      
      // 协调代理资源
      await controller.reconcile(agentResource);
      
      // 验证事件监听器调用
      expect(onReconciled).toHaveBeenCalledWith(expect.objectContaining({
        resource: agentResource
      }));
    });
    
    it('应该能够处理代理删除', async () => {
      // 监听代理清理事件
      const onCleaned = vi.fn();
      eventBus.subscribe('agent.cleaned', onCleaned);
      
      // 触发删除事件
      await controller['handleResourceDeleted'](agentResource);
      
      // 验证事件监听器调用
      expect(onCleaned).toHaveBeenCalledWith(expect.objectContaining({
        resource: agentResource
      }));
    });
  });

  describe('异常处理', () => {
    it('应该能够处理协调失败', async () => {
      // 模拟getDesiredState抛出异常
      vi.spyOn(controller, 'getDesiredState').mockRejectedValueOnce(new Error('测试错误'));
      
      // 协调代理资源
      await controller.reconcile(agentResource);
      
      // 验证状态
      expect(agentResource.status).toBeDefined();
      expect(agentResource.status.phase).toBe('Failed');
      
      // 验证条件
      expect(agentResource.status.conditions).toHaveLength(1);
      expect(agentResource.status.conditions[0].type).toBe('Reconciled');
      expect(agentResource.status.conditions[0].status).toBe('False');
      expect(agentResource.status.conditions[0].reason).toBe('ReconciliationFailed');
    });
  });
}); 