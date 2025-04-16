import { NetworkResource } from '../../src/types';

/**
 * 客服网络资源定义
 */
export const customerSupportNetwork: NetworkResource = {
  apiVersion: 'mastra.ai/v1',
  kind: 'Network',
  metadata: {
    name: 'customer-support-network',
    namespace: 'default'
  },
  spec: {
    // 网络说明，描述网络的总体目标和功能
    instructions: `你是一个智能客服系统，负责协调多个专家代理来回答用户的问题。
你的目标是确保用户得到最准确、最专业的回答。
根据用户的问题内容，你需要决定哪个专家代理最适合回答这个问题。

可用的专家代理:
1. greeter - 接待员，负责欢迎用户并收集基本信息
2. technical - 技术支持专家，负责解决技术问题和故障排除
3. billing - 账单支持专家，负责处理账单、支付和订阅问题
4. product - 产品专家，负责回答关于产品特性和使用方法的问题

你应该根据以下规则路由问题:
- 如果是初次问候或者问题不明确，路由到接待员
- 如果问题涉及技术问题、错误、故障或连接问题，路由到技术支持
- 如果问题涉及账单、支付、订阅或价格，路由到账单支持
- 如果问题涉及产品功能、使用方法或兼容性，路由到产品专家

在路由问题时，你应该考虑用户的整个对话历史，而不仅仅是最后一个问题。`,

    // 网络中的代理列表
    agents: [
      {
        name: 'greeter',
        ref: 'default.greeter-agent'
      },
      {
        name: 'technical',
        ref: 'default.technical-agent'
      },
      {
        name: 'billing',
        ref: 'default.billing-agent'
      },
      {
        name: 'product',
        ref: 'default.product-agent'
      }
    ],
    
    // 路由器配置
    router: {
      model: {
        provider: 'openai',
        name: 'gpt-4o',
      },
      // 最大步骤数限制
      maxSteps: 10
    }
  },
  // 状态字段会在执行过程中被填充
  status: {
    phase: 'Pending',
    conditions: [],
    lastExecutionTime: ''
  }
};

/**
 * 代理角色信息 - 这些信息会在运行时通过状态共享机制传递
 */
export const agentRoles = {
  'greeter': {
    role: 'Greeter',
    specialties: ['initial contact', 'information gathering', 'general inquiries'],
    description: '接待员代理，负责欢迎用户并收集基本信息'
  },
  'technical': {
    role: 'Technical Support',
    specialties: ['troubleshooting', 'error resolution', 'technical guidance'],
    description: '技术支持代理，负责解决技术问题和故障排除'
  },
  'billing': {
    role: 'Billing Support',
    specialties: ['payment issues', 'subscription management', 'pricing questions'],
    description: '账单支持代理，负责处理账单、支付和订阅问题'
  },
  'product': {
    role: 'Product Expert',
    specialties: ['product features', 'usage instructions', 'compatibility'],
    description: '产品专家代理，负责回答关于产品特性和使用方法的问题'
  }
};

/**
 * 客服网络的角色定义
 */
export enum SupportRole {
  GREETER = 'Greeter',
  TECHNICAL = 'Technical Support',
  BILLING = 'Billing Support',
  PRODUCT = 'Product Expert'
}

/**
 * 客服主题分类
 */
export enum SupportTopic {
  GENERAL = 'general',
  TECHNICAL = 'technical',
  BILLING = 'billing',
  PRODUCT = 'product'
}

/**
 * 根据主题获取最佳的代理ID
 */
export function getAgentByTopic(topic: SupportTopic): string {
  switch (topic) {
    case SupportTopic.TECHNICAL:
      return 'technical';
    case SupportTopic.BILLING:
      return 'billing';
    case SupportTopic.PRODUCT:
      return 'product';
    case SupportTopic.GENERAL:
    default:
      return 'greeter';
  }
} 