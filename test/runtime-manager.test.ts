import { Agent } from '@mastra/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeManager, NetworkState, EventBus } from '../src';
import { createNetworkResource } from '../src/types';

describe('RuntimeManager 测试', () => {
  // 创建模拟代理
  const createMockAgent = (name: string, instructions: string = ''): Agent => {
    return {
      name,
      instructions,
      generate: vi.fn().mockResolvedValue({ text: `我是${name}代理的回复` }),
      stream: vi.fn().mockResolvedValue({
        text: `我是${name}代理的流式回复`,
        tokens: [],
        textStream: (async function* () {
          yield `我是${name}代理的流式回复`;
        })(),
        onComplete: vi.fn()
      })
    } as unknown as Agent;
  };

  let runtimeManager: RuntimeManager;
  let chefAgent: Agent;
  let doctorAgent: Agent;

  beforeEach(() => {
    // 创建模拟代理
    chefAgent = createMockAgent('chef', '我是一个厨师，可以回答烹饪问题');
    doctorAgent = createMockAgent('doctor', '我是一个医生，可以回答健康问题');
    
    // 创建运行时管理器
    runtimeManager = new RuntimeManager();
    
    // 添加代理
    runtimeManager.addAgent('agents/chef', chefAgent);
    runtimeManager.addAgent('agents/doctor', doctorAgent);
  });

  describe('代理管理', () => {
    it('应该能够添加和获取代理', () => {
      // 添加新代理
      const teacherAgent = createMockAgent('teacher', '我是一个教师，可以回答教育问题');
      runtimeManager.addAgent('agents/teacher', teacherAgent);
      
      // 验证能够获取代理
      expect(runtimeManager.getAgent('agents/chef')).toBe(chefAgent);
      expect(runtimeManager.getAgent('agents/doctor')).toBe(doctorAgent);
      expect(runtimeManager.getAgent('agents/teacher')).toBe(teacherAgent);
      
      // 验证获取不存在的代理返回undefined
      expect(runtimeManager.getAgent('agents/nonexistent')).toBeUndefined();
    });
  });

  describe('网络资源管理', () => {
    it('应该能够添加网络资源并创建网络执行器', async () => {
      // 创建网络资源
      const networkResource = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Network',
        metadata: {
          name: 'expert-network',
          namespace: 'default'
        },
        spec: {
          instructions: '这是一个专家网络，由厨师和医生组成',
          agents: [
            { name: 'chef', ref: 'agents/chef' },
            { name: 'doctor', ref: 'agents/doctor' }
          ],
          router: {
            model: {
              provider: 'openai',
              name: 'gpt-4'
            },
            maxSteps: 3
          }
        }
      };
      
      // 添加网络资源
      await runtimeManager.addResource(networkResource);
      
      // 获取网络执行器
      const networkId = 'default.expert-network';
      const networkExecutor = runtimeManager.getNetwork(networkId);
      
      // 验证网络执行器存在并能正常工作
      expect(networkExecutor).toBeDefined();
      expect(networkExecutor.getAgents()).toContain('chef');
      expect(networkExecutor.getAgents()).toContain('doctor');
      
      // 执行网络生成
      const result = await networkExecutor.generate('如何健康烹饪？');
      expect(result).toBeDefined();
    });
    
    it('应该能够同时管理多个网络', async () => {
      // 创建两个不同的网络资源
      const cookingNetwork = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Network',
        metadata: {
          name: 'cooking-network',
          namespace: 'default'
        },
        spec: {
          instructions: '这是一个烹饪网络',
          agents: [
            { name: 'chef', ref: 'agents/chef' }
          ],
          router: {
            model: {
              provider: 'openai',
              name: 'gpt-4'
            },
            maxSteps: 3
          }
        }
      };
      
      const healthNetwork = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Network',
        metadata: {
          name: 'health-network',
          namespace: 'default'
        },
        spec: {
          instructions: '这是一个健康网络',
          agents: [
            { name: 'doctor', ref: 'agents/doctor' }
          ],
          router: {
            model: {
              provider: 'openai',
              name: 'gpt-4'
            },
            maxSteps: 3
          }
        }
      };
      
      // 添加网络资源
      await runtimeManager.addResource(cookingNetwork);
      await runtimeManager.addResource(healthNetwork);
      
      // 获取网络执行器
      const cookingExecutor = runtimeManager.getNetwork('default.cooking-network');
      const healthExecutor = runtimeManager.getNetwork('default.health-network');
      
      // 验证两个执行器都存在
      expect(cookingExecutor).toBeDefined();
      expect(healthExecutor).toBeDefined();
      
      // 验证执行器能正常工作
      const cookingResult = await cookingExecutor.generate('如何做蛋糕？');
      const healthResult = await healthExecutor.generate('如何保持健康？');
      
      expect(cookingResult).toBeDefined();
      expect(healthResult).toBeDefined();
      
      // 验证没有可用的网络时抛出错误
      expect(() => {
        runtimeManager.getNetwork('default.nonexistent-network');
      }).toThrow('网络未找到');
    });
  });
}); 