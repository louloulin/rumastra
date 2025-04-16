import { Agent } from '@mastra/core';
import { NetworkExecutor, RoutingStrategy } from '../../src/core/network/executor';
import { customerSupportNetwork, agentRoles, SupportTopic, getAgentByTopic } from './network-definition';
import { greeterAgent, technicalAgent, billingAgent, productAgent, routerAgent } from './agents/agents';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// 模拟代理生成函数
function createMockAgent(id: string, agentResource: any): Agent {
  return {
    id,
    generate: async (input: string) => {
      console.log(`[${agentResource.spec.name}] 处理: ${input}`);
      // 在实际应用中，这里会调用真实的LLM
      return {
        text: `[${agentResource.spec.name}] 回答: ${input.substring(0, 30)}... (模拟响应)`
      };
    },
    stream: async (input: string) => {
      console.log(`[${agentResource.spec.name}] 流式处理: ${input}`);
      // 模拟流式响应
      return {
        text: `[${agentResource.spec.name}] 流式回答: ${input.substring(0, 30)}... (模拟响应)`,
        done: true
      };
    }
  } as Agent;
}

// 路由器的高级模拟
const createRouterAgent = (): Agent => {
  return {
    id: 'router',
    generate: async (input: string, options: any) => {
      console.log(`[Router] 分析问题: ${input.substring(0, 50)}...`);
      
      // 模拟主题检测
      let detectedTopic = SupportTopic.GENERAL;
      
      // 简单的关键词检测
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('error') || lowerInput.includes('crash') || 
          lowerInput.includes('bug') || lowerInput.includes('技术') ||
          lowerInput.includes('连接') || lowerInput.includes('登录') ||
          lowerInput.includes('api') || lowerInput.includes('服务器')) {
        detectedTopic = SupportTopic.TECHNICAL;
      } else if (lowerInput.includes('账单') || lowerInput.includes('支付') || 
                lowerInput.includes('价格') || lowerInput.includes('订阅') ||
                lowerInput.includes('退款') || lowerInput.includes('收费') ||
                lowerInput.includes('发票')) {
        detectedTopic = SupportTopic.BILLING;
      } else if (lowerInput.includes('产品') || lowerInput.includes('功能') || 
                lowerInput.includes('使用') || lowerInput.includes('如何') ||
                lowerInput.includes('支持') || lowerInput.includes('集成') ||
                lowerInput.includes('设置')) {
        detectedTopic = SupportTopic.PRODUCT;
      }
      
      // 基于主题确定最佳代理
      const bestAgentId = getAgentByTopic(detectedTopic);
      
      // 如果提供了网络工具，使用工具调用该代理
      if (options?.toolsets?.routing) {
        // 更新网络状态，记录当前主题
        await options.toolsets.routing['network.setState'].execute({
          key: 'currentTopic',
          value: detectedTopic
        });
        
        await options.toolsets.routing['network.setState'].execute({
          key: 'userInfo',
          value: {
            lastInteraction: new Date().toISOString(),
            topicHistory: [...(options.state?.userInfo?.topicHistory || []), detectedTopic]
          }
        });
        
        // 调用选定的代理
        console.log(`[Router] 转接到 ${bestAgentId} 代理`);
        const result = await options.toolsets.routing[`agent.${bestAgentId}`].execute({
          message: input,
          state: {
            detectedTopic,
            agentRole: agentRoles[bestAgentId],
            previousInteractions: options.state?.previousInteractions || 0
          }
        });
        
        // 合并代理返回的状态
        if (result.state) {
          await options.toolsets.routing['network.setState'].execute({
            key: 'agentResponse',
            value: {
              agentId: bestAgentId,
              topic: detectedTopic,
              responseTime: new Date().toISOString(),
              state: result.state
            }
          });
        }
        
        return {
          text: result.text,
          selectedAgent: bestAgentId
        };
      }
      
      // 如果没有工具，返回简单响应
      return {
        text: `应该由 ${bestAgentId} 代理处理这个问题`,
        selectedAgent: bestAgentId
      };
    }
  } as Agent;
};

// 创建所有代理的映射
const createAgentsMap = () => {
  const agents = new Map<string, Agent>();
  agents.set('greeter', createMockAgent('greeter', greeterAgent));
  agents.set('technical', createMockAgent('technical', technicalAgent));
  agents.set('billing', createMockAgent('billing', billingAgent));
  agents.set('product', createMockAgent('product', productAgent));
  return agents;
};

// 演示不同路由策略的使用
async function demonstrateRoutingStrategies() {
  console.log('\n=== 演示不同的路由策略 ===\n');
  
  const agents = createAgentsMap();
  const router = createRouterAgent();
  const executor = new NetworkExecutor(customerSupportNetwork, agents, router);
  
  const sampleQueries = [
    '你好，我是新用户',
    '我的应用崩溃了，如何修复？',
    '我的信用卡被重复收费了',
    '如何使用数据导出功能？'
  ];
  
  // 1. 默认路由策略
  console.log('\n--- 默认路由策略 ---');
  const result1 = await executor.generate(sampleQueries[0]);
  console.log(`结果: ${result1.text}`);
  
  // 2. 轮询路由策略
  console.log('\n--- 轮询路由策略 ---');
  const result2 = await executor.generate(sampleQueries[1], {
    routingStrategy: RoutingStrategy.ROUND_ROBIN
  });
  console.log(`结果: ${result2.text}`);
  
  // 3. 基于历史的路由策略
  console.log('\n--- 基于历史的路由策略 ---');
  const result3 = await executor.generate(sampleQueries[2], {
    routingStrategy: RoutingStrategy.HISTORY_BASED
  });
  console.log(`结果: ${result3.text}`);
  
  // 4. 自定义路由策略
  console.log('\n--- 自定义路由策略 ---');
  // 根据输入长度选择代理的简单自定义策略
  executor.setCustomRoutingHandler({
    selectNextAgent: async (input, agents) => {
      const length = input.length;
      const agentIds = Array.from(agents.keys());
      const index = length % agentIds.length;
      return agentIds[index];
    }
  });
  
  const result4 = await executor.generate(sampleQueries[3], {
    routingStrategy: RoutingStrategy.CUSTOM
  });
  console.log(`结果: ${result4.text}`);
}

// 展示状态共享和执行追踪
async function demonstrateStateAndTracing() {
  console.log('\n=== 演示状态共享和执行追踪 ===\n');
  
  const agents = createAgentsMap();
  const router = createRouterAgent();
  const executor = new NetworkExecutor(customerSupportNetwork, agents, router);
  
  // 设置初始状态
  const initialState = {
    userInfo: {
      firstVisit: new Date().toISOString(),
      topicHistory: []
    }
  };
  
  // 执行带追踪的查询
  console.log('执行带追踪的查询...');
  const result = await executor.generate(
    '我无法登录系统，而且我认为我的订阅可能已经过期了',
    {
      initialState,
      enableTracing: true
    }
  );
  
  // 打印执行结果
  console.log(`\n结果: ${result.text}`);
  
  // 打印最终状态
  console.log('\n最终状态:');
  console.log(JSON.stringify(executor.getState(), null, 2));
  
  // 打印执行追踪摘要
  if (result.traceSummary) {
    console.log('\n执行追踪摘要:');
    console.log(`总调用次数: ${result.traceSummary.totalCalls}`);
    console.log(`路由器调用次数: ${result.traceSummary.routerCalls}`);
    console.log(`代理调用次数: ${result.traceSummary.agentCalls}`);
    console.log('每个代理的调用次数:');
    Object.entries(result.traceSummary.callsByAgent).forEach(([agent, count]) => {
      console.log(`  - ${agent}: ${count}次`);
    });
    console.log(`总延迟: ${result.traceSummary.totalLatency}ms`);
    console.log(`平均延迟: ${result.traceSummary.averageLatency}ms`);
    console.log(`最大延迟: ${result.traceSummary.maxLatency}ms`);
  }
}

// 交互模式处理用户输入
async function runInteractiveMode() {
  console.log('\n=== 交互模式 ===\n');
  console.log('输入问题或者输入 "exit" 退出');
  
  const agents = createAgentsMap();
  const router = createRouterAgent();
  const executor = new NetworkExecutor(customerSupportNetwork, agents, router);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // 初始化状态
  const userState = {
    sessionStart: new Date().toISOString(),
    messageCount: 0,
    topicHistory: []
  };
  
  // 更新执行器状态
  executor.updateState({ userState });
  
  // 处理用户输入的函数
  const processUserInput = async (input: string) => {
    if (input.toLowerCase() === 'exit') {
      console.log('谢谢使用，再见！');
      rl.close();
      return;
    }
    
    // 更新消息计数
    userState.messageCount++;
    
    try {
      // 使用executor处理输入
      const result = await executor.generate(input, {
        enableTracing: true
      });
      
      console.log(`\n${result.text}\n`);
      
      // 提示用户继续输入
      rl.question('> ', processUserInput);
    } catch (error) {
      console.error('处理输入时出错:', error);
      rl.question('> ', processUserInput);
    }
  };
  
  // 开始交互
  rl.question('> ', processUserInput);
}

// 从示例查询文件加载查询
function loadSampleQueries(): string[] {
  try {
    const filePath = path.join(__dirname, 'sample-queries.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 解析查询，忽略注释和空行
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('##'))
      .map(line => line.trim());
  } catch (error) {
    console.error('无法加载示例查询:', error);
    return [];
  }
}

// 运行批处理模式，处理所有示例查询
async function runBatchMode() {
  console.log('\n=== 批处理模式 ===\n');
  
  const queries = loadSampleQueries();
  if (queries.length === 0) {
    console.log('没有找到示例查询。');
    return;
  }
  
  const agents = createAgentsMap();
  const router = createRouterAgent();
  const executor = new NetworkExecutor(customerSupportNetwork, agents, router);
  
  console.log(`加载了 ${queries.length} 个示例查询`);
  
  // 处理前5个查询作为示例
  const samplesToProcess = queries.slice(0, 5);
  
  for (let i = 0; i < samplesToProcess.length; i++) {
    const query = samplesToProcess[i];
    console.log(`\n处理查询 ${i+1}/${samplesToProcess.length}: "${query}"`);
    
    try {
      const result = await executor.generate(query, {
        enableTracing: true
      });
      
      console.log(`路由到: ${result.selectedAgent || '未知代理'}`);
      console.log(`回应: ${result.text}`);
      
      // 打印追踪信息
      if (result.traces) {
        console.log(`步骤数: ${result.traces.length}`);
      }
    } catch (error) {
      console.error(`处理查询时出错: ${error}`);
    }
  }
}

async function main() {
  // 打印标题
  console.log('\n====================================');
  console.log('  智能客服网络 - NetworkExecutor 示例  ');
  console.log('====================================\n');
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';
  
  switch (mode) {
    case 'routing':
      await demonstrateRoutingStrategies();
      break;
    case 'tracing':
      await demonstrateStateAndTracing();
      break;
    case 'interactive':
      await runInteractiveMode();
      break;
    case 'batch':
      await runBatchMode();
      break;
    case 'all':
    default:
      await demonstrateRoutingStrategies();
      await demonstrateStateAndTracing();
      await runBatchMode();
      
      // 最后进入交互模式
      console.log('\n所有自动演示完成。现在进入交互模式...\n');
      await runInteractiveMode();
      break;
  }
}

// 运行主函数
main().catch(error => {
  console.error('程序执行出错:', error);
}); 