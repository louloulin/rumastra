/**
 * MastraPod 运行时模拟实现
 * 用于在缺少实际@mastra/runtimes包时提供模拟功能
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// 资源存储
const resourceStore = {
  tools: {},
  agents: {},
  workflows: {},
  networks: {}
};

// 创建一个基本的MastraPod类
class MastraPod extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.id = crypto.randomUUID();
    console.log('创建MastraPod实例, ID:', this.id);
  }

  // 执行工具函数
  async executeTool({ tool, function: functionName, params }) {
    if (!tool) {
      throw new Error('未提供工具定义');
    }

    console.log(`模拟执行工具 "${tool.metadata?.name}" 的函数 "${functionName}"`);

    // 模拟执行函数
    // 假设工具函数定义在spec.functions数组中
    const toolFunctions = tool.spec?.functions || [];
    const targetFunction = toolFunctions.find(f => f.name === functionName);

    if (!targetFunction) {
      throw new Error(`工具 "${tool.metadata?.name}" 中找不到函数 "${functionName}"`);
    }

    // 模拟一些常见工具函数的执行
    if (functionName === 'greet' || functionName === 'greeting') {
      const name = params.name || 'Guest';
      return `Hello, ${name}!`;
    } else if (functionName === 'datetime' || functionName === 'getDateTime') {
      return new Date().toLocaleString();
    } else if (functionName === 'calculate' || functionName === 'calculator') {
      if (!params.expression) {
        throw new Error('缺少表达式参数');
      }
      // 简单的计算功能（注意：eval在实际应用中应谨慎使用）
      try {
        // 使用Function构造函数替代eval，更安全
        const calculateFn = new Function(`return ${params.expression}`);
        return {
          expression: params.expression,
          result: calculateFn()
        };
      } catch (error) {
        throw new Error(`计算表达式错误: ${error.message}`);
      }
    } else if (functionName === 'weather' || functionName === 'getWeather') {
      const location = params.location || '北京';
      return {
        location,
        temperature: Math.floor(15 + Math.random() * 15),
        condition: ['晴朗', '多云', '小雨', '大雨'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(50 + Math.random() * 30),
        timestamp: new Date().toISOString()
      };
    } else if (functionName === 'search' || functionName === 'webSearch') {
      const query = params.query || '';
      return {
        query,
        results: [
          { title: `${query}的相关信息1`, url: `https://example.com/1` },
          { title: `关于${query}的详细解释`, url: `https://example.com/2` },
          { title: `${query}的最新进展`, url: `https://example.com/3` }
        ],
        totalResults: 3
      };
    } else {
      // 对于其他未实现的函数，返回一个基本的响应
      return {
        function: functionName,
        params,
        result: `模拟执行 ${functionName} 的结果`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 执行智能体
  async executeAgent({ agent, input }) {
    if (!agent) {
      throw new Error('未提供智能体定义');
    }

    const agentName = agent.metadata?.name || 'unknown';
    console.log(`模拟执行智能体 "${agentName}" 处理输入: "${input}"`);

    // 模拟智能体处理
    const model = agent.spec?.model || { provider: 'openai', name: 'gpt-3.5-turbo' };
    const instructions = agent.spec?.instructions || '你是一个有用的助手。';

    // 生成一个基本的响应
    let response;
    if (input.includes('你好') || input.includes('hello') || input.includes('hi')) {
      response = `你好！我是${agentName}，很高兴为你服务。`;
    } else if (input.includes('时间') || input.includes('日期') || input.includes('time') || input.includes('date')) {
      response = `现在的时间是 ${new Date().toLocaleString()}`;
    } else if (input.includes('天气') || input.includes('weather')) {
      response = `今天的天气预报：北京，25°C，晴朗，相对湿度60%。`;
    } else if (input.includes('帮助') || input.includes('help')) {
      response = `我可以回答问题、提供信息、执行任务等。请告诉我你需要什么帮助。`;
    } else {
      // 基于智能体的指令生成一个更通用的响应
      const shortInstructions = instructions.slice(0, 50);
      response = `基于"${shortInstructions}..."的智能体${agentName}的响应：\n\n我已收到你的请求："${input}"。正在处理中...完成！这是我的回答。`;
    }

    // 模拟一个基本的LLM响应格式
    return {
      text: response,
      metadata: {
        model: model.name,
        provider: model.provider,
        usage: {
          prompt_tokens: input.length * 2,
          completion_tokens: response.length,
          total_tokens: input.length * 2 + response.length
        },
        latency: `${Math.random() * 2 + 0.5}s`
      }
    };
  }

  // 执行工作流
  async executeWorkflow({ workflow, params }) {
    if (!workflow) {
      throw new Error('未提供工作流定义');
    }

    const workflowName = workflow.metadata?.name || 'unknown';
    console.log(`模拟执行工作流 "${workflowName}" 处理参数:`, params);

    // 获取工作流步骤
    const steps = workflow.spec?.steps || [];
    if (steps.length === 0) {
      throw new Error(`工作流 "${workflowName}" 没有定义步骤`);
    }

    // 模拟工作流执行
    const results = [];
    for (const step of steps) {
      console.log(`执行工作流步骤: ${step.name}`);
      
      // 模拟步骤执行
      this.emit('workflow:step:started', { step });
      
      // 生成步骤结果
      const stepResult = {
        name: step.name,
        status: 'completed',
        input: step.input ? this._resolveParams(step.input, params, results) : params,
        output: this._generateStepOutput(step, params, results),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 1000).toISOString()
      };
      
      results.push(stepResult);
      this.emit('workflow:step:completed', { step, result: stepResult });
    }

    // 最终结果通常是最后一个步骤的输出
    const finalOutput = results[results.length - 1].output;
    
    this.emit('workflow:completed', { workflow, results });
    
    return {
      result: finalOutput,
      steps: results,
      metadata: {
        totalSteps: steps.length,
        completedSteps: results.length,
        startTime: results[0]?.startTime,
        endTime: results[results.length - 1]?.endTime
      }
    };
  }

  // 执行网络
  async executeNetwork({ network, input }) {
    if (!network) {
      throw new Error('未提供网络定义');
    }

    const networkName = network.metadata?.name || 'unknown';
    console.log(`模拟执行网络 "${networkName}" 处理输入: "${input}"`);

    // 获取网络中的智能体
    const agents = network.spec?.agents || [];
    if (agents.length === 0) {
      throw new Error(`网络 "${networkName}" 没有定义智能体`);
    }

    // 模拟网络执行
    const agentResults = [];
    for (const agent of agents) {
      console.log(`网络中的智能体 ${agent.name} 处理中...`);
      
      // 模拟智能体贡献
      const contribution = this._generateAgentContribution(agent, input);
      
      agentResults.push({
        name: agent.name,
        contribution,
        timestamp: new Date().toISOString()
      });
    }

    // 生成最终结果
    let finalResult = `网络 "${networkName}" 的综合回答：\n\n`;
    finalResult += `针对您的问题 "${input}"，我们的专家团队提供了以下见解：\n\n`;
    
    agentResults.forEach(ar => {
      finalResult += `- ${ar.name}：${ar.contribution}\n`;
    });
    
    finalResult += `\n总结：基于上述专业意见，建议您...`;

    return {
      text: finalResult,
      agentContributions: agentResults,
      metadata: {
        agentCount: agents.length,
        turns: 1,
        latency: `${Math.random() * 3 + 1}s`
      }
    };
  }

  // 解析参数中的占位符
  _resolveParams(input, params, previousResults) {
    if (typeof input !== 'string') return input;
    
    // 替换形如 {{params.key}} 的占位符
    let result = input.replace(/\{\{params\.([^}]+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
    
    // 替换形如 {{steps.stepName.output}} 的占位符
    result = result.replace(/\{\{steps\.([^.]+)\.output\}\}/g, (match, stepName) => {
      const step = previousResults.find(s => s.name === stepName);
      return step ? JSON.stringify(step.output) : match;
    });
    
    return result;
  }

  // 生成步骤输出
  _generateStepOutput(step, params, previousResults) {
    // 根据步骤类型生成输出
    if (step.type === 'agent' || step.agent) {
      // 模拟智能体输出
      const agentName = step.agent || '通用智能体';
      return {
        text: `智能体 ${agentName} 的响应内容，处理了输入: ${JSON.stringify(step.input)}`,
        metadata: {
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          latency: `${Math.random() * 2 + 0.5}s`
        }
      };
    } else if (step.type === 'tool' || step.tool) {
      // 模拟工具输出
      const toolName = step.tool || '通用工具';
      const functionName = step.function || 'execute';
      
      if (functionName === 'weather' || functionName === 'getWeather') {
        return {
          location: params.location || '北京',
          temperature: 25,
          condition: '晴朗',
          humidity: 60
        };
      } else if (functionName === 'calculate' || functionName === 'calculator') {
        return {
          expression: params.expression || '1+1',
          result: 2
        };
      } else {
        return {
          result: `工具 ${toolName} 的函数 ${functionName} 的执行结果`
        };
      }
    } else if (step.type === 'transform' || step.transform) {
      // 模拟数据转换
      return {
        transformed: true,
        original: step.input,
        result: `转换后的数据: ${JSON.stringify(step.input)}`
      };
    } else {
      // 默认输出
      return {
        status: 'success',
        message: `步骤 ${step.name} 执行完成`,
        data: params
      };
    }
  }

  // 生成智能体贡献
  _generateAgentContribution(agent, input) {
    const name = agent.name || '';
    
    if (name.includes('research') || name.includes('研究')) {
      return '根据最新研究数据分析，这个问题涉及多个领域的交叉知识。根据最近发表的论文显示，该领域已有重要突破。';
    } else if (name.includes('code') || name.includes('编程')) {
      return '从技术实现角度，可以使用以下方案解决：首先建立基础架构，然后实现核心算法，最后优化性能指标。';
    } else if (name.includes('creative') || name.includes('创意')) {
      return '从创新思维出发，我建议从全新角度思考这个问题。打破常规思维局限，探索未被发现的可能性。';
    } else if (name.includes('business') || name.includes('商业')) {
      return '从商业价值角度，这个方案有明显的市场潜力。根据行业趋势分析，未来两年内可能迎来爆发性增长。';
    } else if (name.includes('summary') || name.includes('总结')) {
      return '综合各方面信息，核心要点如下：首先，问题的本质是复杂系统中的变量交互；其次，解决方案需要多维度考量；最后，实施过程中需注意时间和资源分配。';
    } else if (name.includes('travel') || name.includes('旅行')) {
      return '基于目的地分析，推荐以下行程安排：首先参观主要景点，然后体验当地特色活动，最后品尝地道美食。住宿方面可选择市中心的高性价比酒店。';
    } else if (name.includes('math') || name.includes('数学')) {
      return '从数学模型角度，这个问题可以表达为优化方程。通过应用适当的算法，可以在合理时间内找到近似最优解。';
    } else {
      return '作为专业顾问，我建议从系统性思维出发，全面考虑各种因素后再做决策。重要的是保持开放的心态，随时调整策略以适应变化。';
    }
  }
}

// 导出MastraPod类和辅助函数
module.exports = {
  MastraPod,
  
  // 设置资源
  setResource: async (mastraPod, resourceType, name, resource, namespace = 'default') => {
    if (!resourceStore[resourceType]) {
      resourceStore[resourceType] = {};
    }
    
    if (!resourceStore[resourceType][namespace]) {
      resourceStore[resourceType][namespace] = {};
    }
    
    resourceStore[resourceType][namespace][name] = resource;
    mastraPod.emit('resource:added', { 
      resourceType, 
      name, 
      namespace, 
      resource 
    });
    
    console.log(`资源已添加: ${resourceType}/${name} 在命名空间 ${namespace}`);
    return true;
  },
  
  // 获取资源
  getResource: async (mastraPod, resourceType, name, namespace = 'default') => {
    if (!resourceStore[resourceType] || 
        !resourceStore[resourceType][namespace] || 
        !resourceStore[resourceType][namespace][name]) {
      return null;
    }
    
    return resourceStore[resourceType][namespace][name];
  },
  
  // 获取所有资源
  getResources: async (mastraPod, resourceType, namespace = 'default') => {
    if (!resourceStore[resourceType] || !resourceStore[resourceType][namespace]) {
      return [];
    }
    
    return Object.values(resourceStore[resourceType][namespace]);
  },
  
  // 删除资源
  deleteResource: async (mastraPod, resourceType, name, namespace = 'default') => {
    if (!resourceStore[resourceType] || 
        !resourceStore[resourceType][namespace] || 
        !resourceStore[resourceType][namespace][name]) {
      return false;
    }
    
    delete resourceStore[resourceType][namespace][name];
    mastraPod.emit('resource:deleted', { 
      resourceType, 
      name, 
      namespace 
    });
    
    console.log(`资源已删除: ${resourceType}/${name} 在命名空间 ${namespace}`);
    return true;
  }
}; 