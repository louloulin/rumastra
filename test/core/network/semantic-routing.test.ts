import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkExecutor } from '../../../src/core/network/executor';
import { NetworkResource } from '../../../src/types';
import { RoutingStrategy } from '../../../src/core/network/types';

describe('Semantic Matching Routing Strategy', () => {
  let executorWithAgentDescriptions: NetworkExecutor;
  let routerMock: any;
  let agentsMock: Map<string, any>;
  
  beforeEach(() => {
    // 创建模拟代理
    const technicalAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Technical response' })
    };
    
    const customerServiceAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Customer service response' })
    };
    
    const financialAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Financial response' })
    };
    
    // 创建代理映射
    agentsMock = new Map([
      ['technical-agent', technicalAgent],
      ['customer-service-agent', customerServiceAgent],
      ['financial-agent', financialAgent]
    ]);
    
    // 创建路由器模拟
    routerMock = {
      generate: vi.fn().mockImplementation(async (input, options) => {
        // 使用网络工具调用一个或多个代理，并返回结果
        const result = await options.toolsets.routing['network.routeTo'].execute({
          input: input
        });
        
        return {
          text: `Router used ${result.agentUsed}`,
          agentUsed: result.agentUsed,
          response: result.response
        };
      })
    };
    
    // 创建包含代理描述的网络资源
    const networkWithDescriptions: NetworkResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Network',
      metadata: {
        name: 'test-network'
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
    
    // 创建网络执行器
    executorWithAgentDescriptions = new NetworkExecutor(
      networkWithDescriptions,
      agentsMock,
      routerMock
    );
  });
  
  it('should route to technical agent for technical queries', async () => {
    const result = await executorWithAgentDescriptions.generate(
      '我的系统崩溃了，如何修复这个错误？',
      { routingStrategy: RoutingStrategy.SEMANTIC_MATCHING }
    );
    
    expect(result.agentUsed).toBe('technical-agent');
    expect(result.text).toContain('Router used technical-agent');
  });
  
  it('should route to customer service agent for account queries', async () => {
    const result = await executorWithAgentDescriptions.generate(
      '我想查询我的账户状态和最近的服务记录',
      { routingStrategy: RoutingStrategy.SEMANTIC_MATCHING }
    );
    
    expect(result.agentUsed).toBe('customer-service-agent');
    expect(result.text).toContain('Router used customer-service-agent');
  });
  
  it('should route to financial agent for billing queries', async () => {
    const result = await executorWithAgentDescriptions.generate(
      '我的账单有问题，为什么我被多收费了？',
      { routingStrategy: RoutingStrategy.SEMANTIC_MATCHING }
    );
    
    expect(result.agentUsed).toBe('financial-agent');
    expect(result.text).toContain('Router used financial-agent');
  });
  
  it('should choose best match when query contains multiple domain keywords', async () => {
    const result = await executorWithAgentDescriptions.generate(
      '我的账单上显示有技术支持费用，这是什么？',
      { routingStrategy: RoutingStrategy.SEMANTIC_MATCHING }
    );
    
    // 这里应该根据关键词匹配度选择最相关的代理
    // 由于同时包含"账单"和"技术支持"，最终选择哪个取决于算法实现
    expect(['financial-agent', 'technical-agent']).toContain(result.agentUsed);
  });
  
  it('should fallback gracefully when no good match is found', async () => {
    const result = await executorWithAgentDescriptions.generate(
      '今天天气怎么样？',
      { routingStrategy: RoutingStrategy.SEMANTIC_MATCHING }
    );
    
    // 应该有选择的代理，不应该抛出错误
    expect(result.agentUsed).toBeDefined();
  });
}); 