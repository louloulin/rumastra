import { Agent } from '@mastra/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  RuntimeManager, 
  NetworkState, 
  createAgentResource, 
  createToolResource, 
  createWorkflowResource, 
  createNetworkResource 
} from '../src';

describe('RuntimeManager集成测试', () => {
  // 创建模拟代理
  const createMockAgent = (name: string, instructions: string = ''): Agent => {
    return {
      name,
      instructions,
      generate: vi.fn().mockResolvedValue({ text: `我是${name}代理的回复` }),
      stream: vi.fn().mockResolvedValue({
        text: `我是${name}代理的流式回复`,
        tokens: [],
        onComplete: vi.fn()
      })
    } as unknown as Agent;
  };

  let runtimeManager: RuntimeManager;
  let searchAgent: Agent;
  let analysisAgent: Agent;
  let summaryAgent: Agent;
  let routerAgent: Agent;

  beforeEach(() => {
    // 创建RuntimeManager实例
    runtimeManager = new RuntimeManager();
    
    // 创建模拟代理
    searchAgent = createMockAgent('search', '我是搜索代理，负责查找信息');
    analysisAgent = createMockAgent('analysis', '我是分析代理，负责分析数据');
    summaryAgent = createMockAgent('summary', '我是总结代理，负责总结内容');
    routerAgent = createMockAgent('router', '我是路由器代理，负责协调任务');
    
    // 添加代理到运行时
    runtimeManager.addAgent('search-agent', searchAgent);
    runtimeManager.addAgent('analysis-agent', analysisAgent);
    runtimeManager.addAgent('summary-agent', summaryAgent);
    runtimeManager.addAgent('router-agent', routerAgent);
  });

  describe('资源管理', () => {
    it('应该能够添加和获取代理', () => {
      const agent = runtimeManager.getAgent('search-agent');
      expect(agent).toBe(searchAgent);
    });

    it('应该能够添加和协调代理资源', async () => {
      // 创建代理资源
      const agentResource = createAgentResource('search-agent', {
        name: '搜索代理',
        instructions: '我是一个搜索代理',
        model: {
          provider: 'openai',
          name: 'gpt-4'
        }
      });

      // 添加资源到运行时
      await runtimeManager.addResource(agentResource);

      // 验证资源状态
      expect(agentResource.status?.phase).toBe('Running');
    });

    it('应该能够添加和协调工具资源', async () => {
      // 创建工具资源
      const toolResource = createToolResource('search-tool', {
        id: 'search',
        description: '搜索工具',
        execute: 'path/to/execute.js'
      });

      // 添加资源到运行时
      await runtimeManager.addResource(toolResource);

      // 验证资源状态
      expect(toolResource.status?.phase).toBe('Ready');
    });
  });

  describe('工作流管理', () => {
    it('应该能够添加和执行工作流', async () => {
      // 创建工作流资源
      const workflowResource = createWorkflowResource('research-workflow', {
        name: '研究工作流',
        description: '执行研究任务的工作流',
        initialStep: 'search',
        steps: [
          {
            id: 'search',
            name: '搜索步骤',
            agent: 'search-agent',
            next: 'analyze'
          },
          {
            id: 'analyze',
            name: '分析步骤',
            agent: 'analysis-agent',
            next: 'summarize'
          },
          {
            id: 'summarize',
            name: '总结步骤',
            agent: 'summary-agent',
            next: 'END'
          }
        ]
      });

      // 添加资源到运行时
      await runtimeManager.addResource(workflowResource);

      // 获取工作流执行器
      const workflow = runtimeManager.getWorkflow('default.research-workflow');
      expect(workflow).toBeDefined();

      // 执行工作流
      const result = await workflow.execute();
      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
      expect(searchAgent.generate).toHaveBeenCalled();
      expect(analysisAgent.generate).toHaveBeenCalled();
      expect(summaryAgent.generate).toHaveBeenCalled();
    });
  });

  describe('网络管理', () => {
    it('应该能够添加和执行网络', async () => {
      // 创建网络资源
      const networkResource = createNetworkResource('research-network', {
        instructions: '这是一个研究网络，由搜索、分析和总结代理组成',
        agents: [
          { name: 'search', ref: 'search-agent' },
          { name: 'analysis', ref: 'analysis-agent' },
          { name: 'summary', ref: 'summary-agent' }
        ],
        router: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          },
          maxSteps: 5
        }
      });

      // 添加资源到运行时
      await runtimeManager.addResource(networkResource);

      // 获取网络执行器
      const network = runtimeManager.getNetwork('default.research-network');
      expect(network).toBeDefined();

      // 执行网络
      const result = await network.generate('请研究量子计算的最新进展');
      expect(result).toBeDefined();
      expect(routerAgent.generate).toHaveBeenCalled();
    });

    it('应该能够在网络中管理状态', async () => {
      // 创建网络资源
      const networkResource = createNetworkResource('stateful-network', {
        instructions: '这是一个有状态网络',
        agents: [
          { name: 'search', ref: 'search-agent' },
          { name: 'analysis', ref: 'analysis-agent' }
        ],
        router: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          }
        },
        state: {
          persistence: true
        }
      });

      // 添加资源到运行时
      await runtimeManager.addResource(networkResource);

      // 获取网络执行器
      const network = runtimeManager.getNetwork('default.stateful-network');
      
      // 设置初始状态
      network.updateState({ 
        topic: '量子计算',
        stage: 'initial'
      });

      // 验证状态已更新
      const state = network.getState();
      expect(state.topic).toBe('量子计算');
      expect(state.stage).toBe('initial');
      
      // 执行网络
      await network.generate('请开始研究');
      
      // 更新状态并再次执行
      network.updateState({ stage: 'research' });
      await network.generate('继续研究');
      
      // 验证路由器收到了适当的上下文
      expect(routerAgent.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('资源协同', () => {
    it('应该支持不同资源类型之间的协作', async () => {
      // 创建工具资源
      const toolResource = createToolResource('search-tool', {
        id: 'search',
        description: '搜索工具',
        execute: 'path/to/execute.js'
      });

      // 创建代理资源
      const agentResource = createAgentResource('tool-using-agent', {
        name: '使用工具的代理',
        instructions: '我是一个使用工具的代理',
        model: {
          provider: 'openai',
          name: 'gpt-4'
        },
        tools: {
          'search': 'search-tool'
        }
      });

      // 创建工作流资源
      const workflowResource = createWorkflowResource('tool-workflow', {
        name: '工具工作流',
        description: '使用工具的工作流',
        initialStep: 'use-tool',
        steps: [
          {
            id: 'use-tool',
            name: '使用工具步骤',
            agent: 'tool-using-agent',
            next: 'END'
          }
        ]
      });

      // 添加资源到运行时
      await runtimeManager.addResource(toolResource);
      await runtimeManager.addResource(agentResource);
      await runtimeManager.addResource(workflowResource);

      // 验证资源已添加
      expect(toolResource.status?.phase).toBe('Ready');
      expect(agentResource.status?.phase).toBe('Running');
      expect(workflowResource.status?.phase).toBe('Pending');
    });
  });
}); 