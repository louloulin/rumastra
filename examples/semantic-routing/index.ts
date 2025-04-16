/**
 * 语义匹配路由策略示例
 * 
 * 本示例展示如何使用NetworkExecutor的语义匹配路由策略，根据用户输入内容
 * 自动选择最适合的专业智能体来处理请求。
 */

import { Agent } from '@mastra/core';
import { NetworkExecutor } from '../../src/core/network/executor';
import { NetworkResource } from '../../src/types';
import { RoutingStrategy } from '../../src/core/network/types';

// 模拟Agent实现
class MockAgent implements Agent {
  constructor(private name: string, private role: string) {}

  async generate(prompt: string): Promise<any> {
    return {
      text: `${this.name} (${this.role}) 回复: ${prompt}`,
      choices: [
        {
          message: {
            content: `${this.name} (${this.role}) 回复: ${prompt}`
          }
        }
      ]
    };
  }
}

// 创建智能体网络资源定义
const customerSupportNetwork: NetworkResource = {
  apiVersion: 'mastra.ai/v1',
  kind: 'Network',
  metadata: {
    name: 'customer-support'
  },
  spec: {
    agents: [
      {
        name: 'technical-agent',
        ref: 'default.technical-agent',
        role: '技术支持',
        description: '解决技术问题和故障排除',
        specialties: '硬件问题 软件故障 系统错误 网络连接 设备兼容性'
      },
      {
        name: 'customer-service-agent',
        ref: 'default.customer-agent',
        role: '客户服务',
        description: '处理客户问题、投诉和查询',
        specialties: '账户问题 服务咨询 产品信息 投诉处理 退款请求'
      },
      {
        name: 'financial-agent',
        ref: 'default.financial-agent',
        role: '财务顾问',
        description: '处理账单、付款和财务问题',
        specialties: '账单问题 付款处理 退款 订阅 价格咨询'
      }
    ],
    router: {
      model: {
        provider: 'openai',
        name: 'gpt-4o'
      },
      maxSteps: 10
    }
  }
};

// 创建代理实例映射
function createAgentsMap() {
  return new Map([
    ['technical-agent', new MockAgent('技术支持智能体', '技术支持')],
    ['customer-service-agent', new MockAgent('客户服务智能体', '客户服务')],
    ['financial-agent', new MockAgent('财务顾问智能体', '财务顾问')]
  ]);
}

// 创建路由器代理实例
function createRouterAgent() {
  return new MockAgent('路由器', '协调员');
}

// 演示语义匹配路由
async function demonstrateSemanticRouting() {
  console.log('\n=== 语义匹配路由策略示例 ===\n');
  
  const agents = createAgentsMap();
  const router = createRouterAgent();
  const executor = new NetworkExecutor(customerSupportNetwork, agents, router);
  
  const queries = [
    { type: '技术问题', text: '我的系统崩溃了，如何修复这个错误？' },
    { type: '账户问题', text: '我想查询我的账户状态和最近的服务记录' },
    { type: '账单问题', text: '我的账单有问题，为什么我被多收费了？' },
    { type: '混合问题', text: '我的账单上显示有技术支持费用，这是什么？' },
    { type: '一般问题', text: '你们提供哪些服务？' }
  ];
  
  for (const query of queries) {
    console.log(`\n--- ${query.type}: "${query.text}" ---`);
    
    // 使用语义匹配路由策略
    const result = await executor.generate(query.text, {
      routingStrategy: RoutingStrategy.SEMANTIC_MATCHING,
      enableTracing: true
    });
    
    console.log(`选择的智能体: ${result.agentUsed || '未指定'}`);
    console.log(`回复: ${result.text}`);
    
    // 输出匹配得分（如果可用）
    if (result.matchScore) {
      console.log(`匹配得分: ${result.matchScore}`);
    }
  }
  
  // 对比不同路由策略
  console.log('\n=== 不同路由策略对比 ===\n');
  
  const strategyComparisons = [
    { strategy: RoutingStrategy.DEFAULT, name: '默认策略' },
    { strategy: RoutingStrategy.ROUND_ROBIN, name: '轮询策略' },
    { strategy: RoutingStrategy.HISTORY_BASED, name: '基于历史策略' },
    { strategy: RoutingStrategy.SEMANTIC_MATCHING, name: '语义匹配策略' }
  ];
  
  const sampleQuery = '我想升级我的账户，但系统报错，请帮我解决';
  
  for (const comparison of strategyComparisons) {
    console.log(`\n--- ${comparison.name} ---`);
    
    const result = await executor.generate(sampleQuery, {
      routingStrategy: comparison.strategy
    });
    
    console.log(`选择的智能体: ${result.agentUsed || '未指定'}`);
    console.log(`回复: ${result.text}`);
  }
}

// 运行示例
async function run() {
  try {
    await demonstrateSemanticRouting();
  } catch (error) {
    console.error('示例执行出错:', error);
  }
}

// 仅在直接运行时执行
if (require.main === module) {
  run();
}

export { demonstrateSemanticRouting }; 