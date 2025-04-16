#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CLIRuntimeManager } from 'rumastra';
import fs from 'fs';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 确保资源对象有完整的metadata结构
 */
function ensureMetadata(resource) {
  if (!resource) return resource;
  
  // 确保主资源有metadata
  if (!resource.metadata) {
    resource.metadata = {
      name: resource.spec?.name || 'unknown',
      namespace: 'default',
      uid: `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    };
  }
  
  // 确保metadata有必要的字段
  if (!resource.metadata.name) {
    resource.metadata.name = resource.spec?.name || 'unknown';
  }
  
  if (!resource.metadata.namespace) {
    resource.metadata.namespace = 'default';
  }
  
  if (!resource.metadata.uid) {
    resource.metadata.uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  
  return resource;
}

// 工具函数实现
const tools = {
  'web-search': async (query) => {
    console.log(`[WebSearch] 搜索: ${query}`);
    return {
      results: [
        {
          title: '搜索结果1',
          summary: `关于 ${query} 的详细信息...`
        },
        {
          title: '搜索结果2',
          summary: `更多关于 ${query} 的信息...`
        }
      ]
    };
  },
  'calculator': async (expression) => {
    console.log(`[Calculator] 计算: ${expression}`);
    const result = eval(expression);
    return { result };
  },
  'weather': async (location) => {
    console.log(`[Weather] 获取${location}的天气`);
    return {
      location,
      condition: '晴天',
      temperature: 25
    };
  },
  'news': async (topic) => {
    console.log(`[News] 获取${topic}相关新闻`);
    return {
      news: [
        {
          title: '新闻1',
          summary: `${topic}的最新进展...`
        },
        {
          title: '新闻2',
          summary: `${topic}的相关报道...`
        }
      ]
    };
  }
};

/**
 * MastraRuntimeWrapper - Mastra运行时包装器
 * 添加必要的兼容性和错误处理
 */
class MastraRuntimeWrapper {
  constructor(options = {}) {
    this.options = options;
    this.debug = options.debug || false;
    
    // 创建原始的 CLIRuntimeManager
    this.manager = new CLIRuntimeManager();
    
    // 存储已加载的资源
    this.resources = {
      Tool: new Map(),
      Agent: new Map(),
      Workflow: new Map(),
      Network: new Map()
    };
    
    // 初始化模拟执行函数
    this.initializeExecutors();
    
    if (this.debug) {
      console.log('[MastraRuntimeWrapper] 已初始化');
    }
  }
  
  /**
   * 初始化模拟执行器
   */
  initializeExecutors() {
    // 代理执行器
    this.agentExecutor = async (agentName, input) => {
      console.log(`[AgentExecutor] 执行代理: ${agentName}`);
      const agent = this.resources.Agent.get(agentName);
      
      if (!agent) {
        throw new Error(`找不到代理: ${agentName}`);
      }
      
      // 检查代理是否有工具
      if (agent.spec.tools) {
        // 提取输入中可能的工具调用
        if (input.toLowerCase().includes('搜索') || input.toLowerCase().includes('search')) {
          const query = input.replace(/.*搜索关于|.*search about/i, '').replace(/[?？\s]*$/, '');
          console.log(`[AgentExecutor] 检测到搜索请求: ${query}`);
          
          // 模拟工具执行
          const searchResults = await this.callTool('web-search', query);
          return `我搜索了关于"${query}"的信息，找到了以下结果:\n\n${JSON.stringify(searchResults.results, null, 2)}\n\n根据搜索结果，${query}是一个重要的主题，有多个相关资料可供参考。`;
        }
        
        if (input.toLowerCase().includes('天气') || input.toLowerCase().includes('weather')) {
          const location = input.match(/[北上广深杭]\w*|beijing|shanghai|guangzhou|shenzhen|hangzhou/i)?.[0] || '北京';
          console.log(`[AgentExecutor] 检测到天气请求: ${location}`);
          
          // 模拟工具执行
          const weatherInfo = await this.callTool('weather', location);
          return `${location}的天气情况是: ${weatherInfo.condition}，温度${weatherInfo.temperature}°C。根据天气情况，我建议${weatherInfo.condition.includes('雨') ? '带伞出行，注意防滑' : '穿着舒适，注意防晒'}。`;
        }
        
        if (input.toLowerCase().includes('新闻') || input.toLowerCase().includes('news')) {
          const topic = input.replace(/.*关于|.*about/i, '').replace(/的新闻.*|news.*$/i, '').trim();
          console.log(`[AgentExecutor] 检测到新闻请求: ${topic}`);
          
          // 模拟工具执行
          const newsResults = await this.callTool('news', topic);
          return `以下是关于"${topic}"的最新新闻:\n\n${newsResults.news.map(n => `- ${n.title}: ${n.summary}`).join('\n')}`;
        }
        
        if (input.toLowerCase().includes('计算') || input.toLowerCase().includes('calculate')) {
          // 尝试从输入中提取运算
          const match = input.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
          if (match) {
            const [, a, op, b] = match;
            let operation;
            switch (op) {
              case '+': operation = 'add'; break;
              case '-': operation = 'subtract'; break;
              case '*': operation = 'multiply'; break;
              case '/': operation = 'divide'; break;
            }
            
            console.log(`[AgentExecutor] 检测到计算请求: ${a} ${op} ${b}`);
            
            // 模拟工具执行
            const calcResult = await this.callTool('calculator', `${a} ${op} ${b}`);
            
            return `计算 ${a} ${op} ${b} 的结果是 ${calcResult.result}`;
          }
        }
      }
      
      // 根据代理角色模拟不同类型的响应
      if (agent.spec.id === 'research-agent') {
        return `作为研究助手，我已分析了您关于"${input.split(' ').slice(-1)[0]}"的请求。这是一个有趣的话题，有多个值得探讨的方面...`;
      }
      
      if (agent.spec.id === 'math-agent') {
        return `作为数学助手，我分析了您的问题。这是一个${input.includes('难') ? '复杂' : '基础'}的数学问题，解题步骤如下...`;
      }
      
      if (agent.spec.id === 'travel-agent') {
        return `作为旅行顾问，我认为您的旅行计划很有趣。考虑到当前情况，我建议您关注安全和舒适度...`;
      }
      
      if (agent.spec.id === 'summary-agent') {
        return `已为您总结关键信息。主要内容包括三个方面：首先，...；其次，...；最后，...。希望这个总结对您有所帮助。`;
      }
      
      // 默认响应
      return `代理 ${agentName} 的响应: 我已收到您的请求，正在处理中...`;
    };
    
    // 工作流执行器
    this.workflowExecutor = async (workflowName, input) => {
      console.log(`[WorkflowExecutor] 执行工作流: ${workflowName}`);
      const workflow = this.resources.Workflow.get(workflowName);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${workflowName}`);
      }
      
      const results = {};
      const steps = [];
      
      // 获取初始步骤
      let currentStep = workflow.spec.steps.find(s => s.id === workflow.spec.initialStep);
      
      // 执行工作流步骤
      while (currentStep) {
        console.log(`[WorkflowExecutor] 执行步骤: ${currentStep.id}`);
        
        // 准备输入 - 替换模板变量
        let stepInput = currentStep.input.message;
        
        // 替换工作流输入变量
        if (input && stepInput.includes('{{ workflow.input.')) {
          for (const [key, value] of Object.entries(input)) {
            stepInput = stepInput.replace(new RegExp(`\\{\\{\\s*workflow\\.input\\.${key}\\s*\\}\\}`, 'g'), value);
          }
        }
        
        // 替换步骤结果变量
        if (stepInput.includes('{{ step.')) {
          for (const [stepId, result] of Object.entries(results)) {
            stepInput = stepInput.replace(new RegExp(`\\{\\{\\s*step\\.${stepId}\\.result\\s*\\}\\}`, 'g'), result);
          }
        }
        
        // 执行代理
        try {
          const agentName = typeof currentStep.agent === 'string' ? currentStep.agent : currentStep.agent.metadata.name;
          const result = await this.executeAgent(agentName, stepInput);
          
          // 保存结果
          results[currentStep.id] = result;
          steps.push({
            id: currentStep.id,
            name: currentStep.name,
            agent: agentName,
            input: stepInput,
            output: result
          });
          
          // 获取下一步
          if (currentStep.next === 'END') {
            currentStep = null;
          } else {
            currentStep = workflow.spec.steps.find(s => s.id === currentStep.next);
          }
        } catch (error) {
          console.error(`[WorkflowExecutor] 步骤执行失败: ${currentStep.id}`, error);
          throw new Error(`工作流步骤执行失败: ${currentStep.id} - ${error.message}`);
        }
      }
      
      return {
        result: steps[steps.length - 1]?.output || '工作流执行完成',
        completed: true,
        steps
      };
    };
    
    // 网络执行器
    this.networkExecutor = async (networkName, input) => {
      console.log(`[NetworkExecutor] 执行网络: ${networkName}`);
      const network = this.resources.Network.get(networkName);
      
      if (!network) {
        throw new Error(`找不到网络: ${networkName}`);
      }
      
      // 模拟路由选择
      let selectedAgent;
      
      if (input.message.toLowerCase().includes('数学') || input.message.toLowerCase().includes('计算')) {
        selectedAgent = network.spec.agents.find(a => a.name === 'mathematician');
      } else if (input.message.toLowerCase().includes('旅行') || input.message.toLowerCase().includes('旅游') || 
                input.message.toLowerCase().includes('天气')) {
        selectedAgent = network.spec.agents.find(a => a.name === 'travel-advisor');
      } else if (input.message.toLowerCase().includes('总结') || input.message.toLowerCase().includes('摘要')) {
        selectedAgent = network.spec.agents.find(a => a.name === 'summarizer');
      } else {
        selectedAgent = network.spec.agents.find(a => a.name === 'researcher');
      }
      
      // 执行选中的代理
      if (selectedAgent) {
        console.log(`[NetworkExecutor] 选择代理: ${selectedAgent.name} (${selectedAgent.ref})`);
        const agentName = selectedAgent.ref.split('.')[1];
        const result = await this.executeAgent(agentName, input.message);
        
        return {
          answer: result,
          agent: selectedAgent.name,
          completed: true
        };
      }
      
      return {
        answer: '没有合适的代理处理此请求',
        completed: false
      };
    };
  }
  
  /**
   * 初始化运行时
   */
  async initialize() {
    try {
      await this.manager.initialize();
      if (this.debug) {
        console.log('[MastraRuntimeWrapper] 初始化完成');
      }
      return true;
    } catch (error) {
      console.error('[MastraRuntimeWrapper] 初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 解析MastraPod配置
   */
  async parseMastraPod(podPath) {
    try {
      if (this.debug) {
        console.log(`[MastraRuntimeWrapper] 解析MastraPod: ${podPath}`);
      }
      
      // 使用原始CLIRuntimeManager解析
      const result = await this.manager.parseMastraPod(podPath);
      
      // 确保所有资源都有metadata
      result.resources.forEach(ensureMetadata);
      
      return result;
    } catch (error) {
      console.error('[MastraRuntimeWrapper] 解析MastraPod失败:', error);
      throw error;
    }
  }
  
  /**
   * 应用全局配置
   */
  async applyGlobalConfig(config) {
    if (this.debug) {
      console.log('[MastraRuntimeWrapper] 应用全局配置:', config.providers ? Object.keys(config.providers).join(', ') : '无');
    }
    
    // 将全局配置应用到运行时
    try {
      // 处理环境变量替换
      if (config.providers) {
        for (const [provider, providerConfig] of Object.entries(config.providers)) {
          for (const [key, value] of Object.entries(providerConfig)) {
            if (typeof value === 'string' && value.startsWith('${env.') && value.endsWith('}')) {
              const envVar = value.substring(6, value.length - 1);
              providerConfig[key] = process.env[envVar] || '';
              
              if (!process.env[envVar]) {
                console.warn(`[MastraRuntimeWrapper] 警告: 环境变量 ${envVar} 未设置`);
              }
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('[MastraRuntimeWrapper] 应用全局配置失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载资源
   */
  async loadResource(resource) {
    // 确保resource有metadata
    ensureMetadata(resource);
    
    // 存储资源
    if (resource.kind && this.resources[resource.kind]) {
      this.resources[resource.kind].set(resource.metadata.name, resource);
      if (this.debug) {
        console.log(`[MastraRuntimeWrapper] 已加载: ${resource.kind}/${resource.metadata.name}`);
      }
    } else {
      console.log(`[MastraRuntimeWrapper] 未知资源类型: ${resource.kind}`);
    }
    
    return { success: true };
  }
  
  /**
   * 调用工具
   */
  async callTool(toolId, params) {
    console.log(`[MastraRuntimeWrapper] 调用工具: ${toolId}`);
    try {
      const toolFunction = tools[toolId];
      if (!toolFunction) {
        throw new Error(`未找到工具: ${toolId}`);
      }
      return await toolFunction(params);
    } catch (error) {
      console.error(`[MastraRuntimeWrapper] 工具执行失败: ${toolId}`, error);
      throw error;
    }
  }
  
  /**
   * 执行代理
   */
  async executeAgent(agentName, input) {
    if (this.debug) {
      console.log(`[MastraRuntimeWrapper] 执行代理: ${agentName}, 输入:`, input);
    }
    
    try {
      return await this.agentExecutor(agentName, input);
    } catch (error) {
      console.error(`[MastraRuntimeWrapper] 代理执行失败: ${agentName}`, error);
      throw new Error(`代理执行失败: ${agentName} - ${error.message}`);
    }
  }
  
  /**
   * 执行工作流
   */
  async executeWorkflow(workflowName, input) {
    if (this.debug) {
      console.log(`[MastraRuntimeWrapper] 执行工作流: ${workflowName}, 输入:`, input);
    }
    
    try {
      return await this.workflowExecutor(workflowName, input);
    } catch (error) {
      console.error(`[MastraRuntimeWrapper] 工作流执行失败: ${workflowName}`, error);
      throw new Error(`工作流执行失败: ${workflowName} - ${error.message}`);
    }
  }
  
  /**
   * 执行网络
   */
  async executeNetwork(networkName, input) {
    if (this.debug) {
      console.log(`[MastraRuntimeWrapper] 执行网络: ${networkName}, 输入:`, input);
    }
    
    try {
      return await this.networkExecutor(networkName, input);
    } catch (error) {
      console.error(`[MastraRuntimeWrapper] 网络执行失败: ${networkName}`, error);
      throw new Error(`网络执行失败: ${networkName} - ${error.message}`);
    }
  }
  
  /**
   * 运行MastraPod
   */
  async runMastraPod(podPath, networkRequest = null, workflowRequest = null) {
    try {
      // 设置环境变量
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-mock-key';
      process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-mock-key';
      
      // 初始化运行时
      await this.initialize();
      
      // MastraPod文件路径
      console.log(`加载MastraPod配置文件: ${podPath}`);
      
      // 解析MastraPod配置
      const { podConfig, resources } = await this.parseMastraPod(podPath);
      
      // 应用全局配置
      await this.applyGlobalConfig(podConfig);
      console.log('已应用全局配置');
      
      // 加载所有资源
      console.log(`准备加载 ${resources.length} 个资源...`);
      for (const resource of resources) {
        try {
          // 加载资源
          await this.loadResource(resource);
        } catch (error) {
          console.error(`加载资源失败 ${resource.kind}/${resource.metadata?.name || 'unknown'}: ${error.message}`);
        }
      }
      
      // 显示加载的资源列表
      console.log("\n已加载的资源:");
      for (const [kind, map] of Object.entries(this.resources)) {
        if (map.size > 0) {
          console.log(`- ${kind}: ${Array.from(map.keys()).join(', ')}`);
        }
      }
      console.log("");
      
      // 执行网络请求（如果有）
      if (networkRequest) {
        const networkName = networkRequest.network;
        const input = networkRequest.input;
        
        console.log(`\n执行网络: ${networkName}，输入: ${JSON.stringify(input)}`);
        const networkResult = await this.executeNetwork(networkName, input);
        console.log(`\n网络执行结果:`);
        console.log(`使用的代理: ${networkResult.agent}`);
        console.log(`回答: ${networkResult.answer}`);
        console.log("");
      }
      
      // 执行工作流请求（如果有）
      if (workflowRequest) {
        const workflowName = workflowRequest.workflow;
        const input = workflowRequest.input;
        
        console.log(`\n执行工作流: ${workflowName}，输入: ${JSON.stringify(input)}`);
        const workflowResult = await this.executeWorkflow(workflowName, input);
        console.log(`\n工作流执行结果:`);
        console.log(`最终结果: ${workflowResult.result}`);
        console.log("\n执行的步骤:");
        for (const step of workflowResult.steps) {
          console.log(`- ${step.name} (${step.id}): ${step.output.substring(0, 100)}...`);
        }
        console.log("");
      }
      
      return {
        success: true,
        message: '成功执行 MastraPod'
      };
    } catch (error) {
      console.error('执行MastraPod失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * 主函数 - 运行示例
 */
async function main() {
  console.log('==== Mastra Runtimes 综合示例 ====');
  console.log('加载基于DSL的配置并执行...\n');
  
  const runtimeWrapper = new MastraRuntimeWrapper({ debug: false });
  const configPath = join(__dirname, 'config.yaml');
  
  // 示例1：执行智能体网络
  const networkRequest = {
    network: 'personal-assistant-network',
    input: { message: '请帮我搜索关于量子计算的最新进展' }
  };
  
  // 示例2：执行研究工作流
  const workflowRequest = {
    workflow: 'research-workflow',
    input: { topic: '人工智能在医疗领域的应用' }
  };
  
  // 运行MastraPod
  await runtimeWrapper.runMastraPod(configPath, networkRequest, workflowRequest);
  
  // 额外示例：旅行规划工作流
  console.log('\n==== 执行旅行规划工作流 ====\n');
  const travelWorkflowRequest = {
    workflow: 'travel-planning-workflow',
    input: { 
      destination: '杭州',
      duration: '3',
      budget: '中等预算'
    }
  };
  
  // 运行MastraPod - 仅执行旅行工作流
  await runtimeWrapper.runMastraPod(configPath, null, travelWorkflowRequest);
  
  console.log('\n==== 示例执行完成 ====');
}

// 执行主函数
main().catch(console.error); 