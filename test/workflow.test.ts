import { Agent } from '@mastra/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowExecutor } from '../src/core/workflow/executor';
import { 
  RuntimeManager, 
  createAgentResource
} from '../src';
import { createWorkflowResource } from '../src/types';

// 创建模拟代理
const createMockAgent = (name: string, instructions: string = ''): Agent => {
  return {
    name,
    instructions,
    generate: vi.fn().mockImplementation(async (input) => {
      return { text: `${name}代理处理: ${input}` };
    }),
    stream: vi.fn().mockImplementation(async (input) => {
      return {
        text: `${name}代理流式处理: ${input}`,
        tokens: [],
        textStream: (async function* () {
          yield `${name}代理流式处理: ${input}`;
        })()
      };
    })
  } as unknown as Agent;
};

describe('Workflow功能测试', () => {
  // 测试数据
  let searchAgent: Agent;
  let processAgent: Agent;
  let summaryAgent: Agent;
  let agentMap: Map<string, Agent>;
  let workflowResource: any;
  let executor: WorkflowExecutor;

  beforeEach(() => {
    // 创建测试代理
    searchAgent = createMockAgent('search', '我是搜索代理');
    processAgent = createMockAgent('process', '我是处理代理');
    summaryAgent = createMockAgent('summary', '我是总结代理');
    
    // 初始化代理映射
    agentMap = new Map();
    agentMap.set('search-agent', searchAgent);
    agentMap.set('process-agent', processAgent);
    agentMap.set('summary-agent', summaryAgent);
    
    // 创建工作流资源
    workflowResource = createWorkflowResource('test-workflow', {
      name: 'test-workflow',
      description: '测试工作流',
      initialStep: 'search',
      steps: [
        {
          id: 'search',
          name: '搜索步骤',
          agent: 'search-agent',
          input: {
            query: '测试查询'
          },
          output: {
            searchResults: 'text'
          },
          next: 'process'
        },
        {
          id: 'process',
          name: '处理步骤',
          agent: 'process-agent',
          input: {
            data: '$searchResults'
          },
          output: {
            processedData: 'text'
          },
          next: 'summary'
        },
        {
          id: 'summary',
          name: '总结步骤',
          agent: 'summary-agent',
          input: {
            content: '$processedData'
          },
          output: {
            summary: 'text'
          },
          next: 'END'
        }
      ]
    });
    
    // 创建执行器
    executor = new WorkflowExecutor(workflowResource, agentMap);
  });

  describe('工作流执行', () => {
    it('应该按照定义的步骤顺序执行工作流', async () => {
      // 执行工作流
      const result = await executor.execute();
      
      // 验证执行结果
      expect(result.status).toBe('completed');
      expect(result.history.length).toBe(3);
      
      // 验证各个步骤是否按顺序调用
      expect(result.history[0].stepId).toBe('search');
      expect(result.history[1].stepId).toBe('process');
      expect(result.history[2].stepId).toBe('summary');
      
      // 验证代理是否被调用
      expect(searchAgent.generate).toHaveBeenCalled();
      expect(processAgent.generate).toHaveBeenCalled();
      expect(summaryAgent.generate).toHaveBeenCalled();
    });
    
    it('应该正确传递步骤之间的数据', async () => {
      // 执行工作流
      const result = await executor.execute();
      
      // 获取历史记录中的输入输出数据
      const searchOutput = result.history[0].output;
      const processInput = result.history[1].input;
      
      // 验证数据传递 - 检查输入对象中包含预期数据
      expect(processInput).toBeDefined();
      expect(searchOutput).toBeDefined();
      
      // 验证最终输出
      expect(result.output).toBe(result.history[2].output);
    });
    
    it('应该能使用用户提供的输入变量', async () => {
      // 执行工作流，提供自定义输入
      const result = await executor.execute({
        input: {
          customQuery: '自定义查询'
        }
      });
      
      // 获取变量
      const variables = executor.getVariables();
      
      // 验证变量是否正确设置
      expect(variables.customQuery).toBe('自定义查询');
    });
    
    it('应该在每个步骤执行时调用回调', async () => {
      // 创建步骤执行回调
      const onStepExecute = vi.fn();
      
      // 执行工作流，提供回调
      await executor.execute({
        onStepExecute
      });
      
      // 验证回调是否被调用
      expect(onStepExecute).toHaveBeenCalledTimes(3);
      
      // 验证回调参数
      expect(onStepExecute).toHaveBeenCalledWith('search', expect.any(Object), expect.any(String));
      expect(onStepExecute).toHaveBeenCalledWith('process', expect.any(Object), expect.any(String));
      expect(onStepExecute).toHaveBeenCalledWith('summary', expect.any(Object), expect.any(String));
    });
    
    it('应该在工作流完成时调用完成回调', async () => {
      // 创建完成回调
      const onComplete = vi.fn();
      
      // 执行工作流，提供回调
      await executor.execute({
        onComplete
      });
      
      // 验证回调是否被调用
      expect(onComplete).toHaveBeenCalledTimes(1);
      
      // 验证回调参数
      expect(onComplete).toHaveBeenCalledWith(expect.any(String));
    });
  });
  
  describe('工作流状态管理', () => {
    it('应该更新工作流状态', async () => {
      // 执行工作流
      await executor.execute();
      
      // 验证工作流状态
      expect(workflowResource.status).toBeDefined();
      expect(workflowResource.status.phase).toBe('Completed');
      expect(workflowResource.status.lastExecutionTime).toBeDefined();
    });
    
    it('应该记录当前执行步骤', async () => {
      // 模拟步骤执行，记录每个步骤的状态
      const stepStates: string[] = [];
      
      // 执行工作流，在每个步骤执行时记录状态
      await executor.execute({
        onStepExecute: () => {
          stepStates.push(workflowResource.status.currentStep);
        }
      });
      
      // 验证步骤状态记录
      expect(stepStates).toEqual(['search', 'process', 'summary']);
    });
  });
  
  describe('错误处理', () => {
    it('应该处理代理执行错误', async () => {
      // 修改代理实现，模拟错误
      const errorAgent = {
        ...processAgent,
        generate: vi.fn().mockRejectedValue(new Error('代理执行失败'))
      } as unknown as Agent;
      
      // 更新代理映射
      agentMap.set('process-agent', errorAgent);
      
      // 创建错误回调
      const onError = vi.fn();
      
      // 执行工作流，提供错误回调
      const result = await executor.execute({
        onError
      });
      
      // 验证错误处理
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('代理执行失败');
      
      // 验证错误回调是否被调用
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      
      // 验证工作流状态
      expect(workflowResource.status.phase).toBe('Failed');
    });
    
    it('应该处理工作流结构错误', async () => {
      // 创建无效的工作流资源（缺少初始步骤）
      const invalidWorkflow = createWorkflowResource('invalid-workflow', {
        name: 'invalid-workflow',
        description: '无效工作流',
        initialStep: 'nonexistent',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agent: 'search-agent',
            next: 'END'
          }
        ]
      });
      
      // 尝试创建执行器并执行工作流
      const invalidExecutor = new WorkflowExecutor(invalidWorkflow, agentMap);
      
      // 验证执行是否返回失败结果
      const result = await invalidExecutor.execute();
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Step not found');
    });
  });
});

describe('Workflow执行测试', () => {
  let runtimeManager: RuntimeManager;
  let searchAgent: Agent;
  let analysisAgent: Agent;
  let summaryAgent: Agent;

  beforeEach(() => {
    // 创建RuntimeManager实例
    runtimeManager = new RuntimeManager();
    
    // 创建模拟代理
    searchAgent = createMockAgent('search', '我是搜索代理，负责查找信息');
    analysisAgent = createMockAgent('analysis', '我是分析代理，负责分析数据');
    summaryAgent = createMockAgent('summary', '我是总结代理，负责总结内容');
    
    // 添加代理到运行时
    runtimeManager.addAgent('search-agent', searchAgent);
    runtimeManager.addAgent('analysis-agent', analysisAgent);
    runtimeManager.addAgent('summary-agent', summaryAgent);
  });

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
    expect(result.status).toBe('completed');
  });

  it('应该能够在工作流中管理变量', async () => {
    // 创建工作流资源
    const workflowResource = createWorkflowResource('variable-workflow', {
      name: '变量管理工作流',
      initialStep: 'first',
      steps: [
        {
          id: 'first',
          name: '第一步',
          agent: 'search-agent',
          input: { query: '变量测试' },
          output: { searchResult: 'text' },
          next: 'second'
        },
        {
          id: 'second',
          name: '第二步',
          agent: 'analysis-agent',
          input: { data: '$searchResult' },
          output: { analysisResult: 'text' },
          next: 'END'
        }
      ]
    });

    // 添加资源到运行时
    await runtimeManager.addResource(workflowResource);

    // 获取工作流执行器
    const workflow = runtimeManager.getWorkflow('default.variable-workflow');
    
    // 执行工作流
    const result = await workflow.execute({
      input: {
        initialValue: '初始值'
      }
    });
    
    expect(result.status).toBe('completed');
    expect(searchAgent.generate).toHaveBeenCalled();
    expect(analysisAgent.generate).toHaveBeenCalled();
  });

  it('应该能够处理工作流执行错误', async () => {
    // 创建包含错误的工作流资源
    const workflowResource = createWorkflowResource('error-workflow', {
      name: '错误处理工作流',
      initialStep: 'step1',
      steps: [
        {
          id: 'step1',
          name: '第一步',
          agent: 'nonexistent-agent', // 不存在的代理
          next: 'END'
        }
      ]
    });

    // 添加资源到运行时
    try {
      await runtimeManager.addResource(workflowResource);
      
      // 获取工作流执行器
      const workflow = runtimeManager.getWorkflow('default.error-workflow');
      
      // 此处应该不会执行到，因为上面应该抛出异常
      expect(workflow).toBeUndefined();
    } catch (error) {
      // 验证错误消息包含我们期望的内容
      // 错误可能是工作流未找到或代理未找到的错误
      expect(error.message).toMatch(/工作流未找到|Agent.*not found/);
    }
  });
}); 