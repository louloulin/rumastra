#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 模拟QWEN提供商配置
const QWEN_CONFIG = {
  baseURL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  defaultModel: 'qwen-max'
};

/**
 * 直接运行时管理器 - 无依赖版本
 */
class SimpleRuntimeManager {
  constructor() {
    console.log('[SimpleRuntimeManager] 初始化...');
    
    // 存储资源
    this.resources = {
      agents: new Map(),
      tools: new Map(),
      workflows: new Map()
    };
    
    // 配置
    this.config = {
      providers: {}
    };
  }
  
  /**
   * 加载MastraPod配置
   */
  async loadPod(podPath) {
    console.log(`[SimpleRuntimeManager] 加载配置: ${podPath}`);
    
    try {
      // 读取YAML文件
      const content = fs.readFileSync(podPath, 'utf8');
      const pod = yaml.load(content);
      
      if (!pod || pod.kind !== 'MastraPod') {
        throw new Error('无效的MastraPod配置');
      }
      
      // 提取全局配置
      this.config.providers = pod.spec?.providers || {};
      
      // 处理环境变量
      this.setupEnvironment();
      
      // 注册资源
      if (pod.spec?.resources) {
        // 注册工具
        if (pod.spec.resources.tools) {
          for (const tool of pod.spec.resources.tools) {
            this.resources.tools.set(tool.name, {
              name: tool.name,
              type: tool.type,
              spec: tool
            });
            console.log(`[SimpleRuntimeManager] 已注册工具: ${tool.name}`);
          }
        }
        
        // 注册代理
        if (pod.spec.resources.agents) {
          for (const agent of pod.spec.resources.agents) {
            // 处理代理的工具引用
            const agentTools = {};
            
            if (agent.tools) {
              for (const [toolName, toolRef] of Object.entries(agent.tools)) {
                if (typeof toolRef === 'string') {
                  // 查找已注册的工具
                  const tool = this.resources.tools.get(toolRef);
                  if (tool) {
                    agentTools[toolName] = tool;
                  } else {
                    console.warn(`[SimpleRuntimeManager] 代理 ${agent.name} 引用的工具未找到: ${toolRef}`);
                  }
                } else {
                  // 内联工具定义
                  agentTools[toolName] = toolRef;
                }
              }
            }
            
            // 存储代理
            this.resources.agents.set(agent.name, {
              name: agent.name,
              spec: agent,
              tools: agentTools
            });
            
            console.log(`[SimpleRuntimeManager] 已注册代理: ${agent.name}`);
          }
        }
        
        // 注册工作流
        if (pod.spec.resources.workflows) {
          for (const workflow of pod.spec.resources.workflows) {
            // 处理工作流的代理引用
            const workflowSteps = workflow.steps.map(step => {
              let agentRef = step.agent;
              
              // 如果是字符串引用，转换为对象引用
              if (typeof agentRef === 'string') {
                const agent = this.resources.agents.get(agentRef);
                if (agent) {
                  agentRef = agent;
                } else {
                  console.warn(`[SimpleRuntimeManager] 工作流 ${workflow.name} 引用的代理未找到: ${agentRef}`);
                }
              }
              
              return {
                ...step,
                agent: agentRef
              };
            });
            
            // 存储工作流
            this.resources.workflows.set(workflow.name, {
              name: workflow.name,
              spec: workflow,
              steps: workflowSteps
            });
            
            console.log(`[SimpleRuntimeManager] 已注册工作流: ${workflow.name}`);
          }
        }
      }
      
      return {
        providers: Object.keys(this.config.providers),
        resources: {
          agents: Array.from(this.resources.agents.keys()),
          tools: Array.from(this.resources.tools.keys()),
          workflows: Array.from(this.resources.workflows.keys())
        }
      };
    } catch (error) {
      console.error(`[SimpleRuntimeManager] 加载配置失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 设置环境变量
   */
  setupEnvironment() {
    console.log('[SimpleRuntimeManager] 设置环境变量...');
    
    // 设置日志级别
    console.log('日志级别: info');
    
    // 处理提供商配置
    for (const [provider, config] of Object.entries(this.config.providers)) {
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      
      // 设置API密钥
      if (config.apiKey && !process.env[envKey]) {
        process.env[envKey] = config.apiKey;
        console.log(`[SimpleRuntimeManager] 已设置 ${envKey}`);
      }
      
      // 检查API密钥
      if (!process.env[envKey] || process.env[envKey] === 'sk-mock-key') {
        console.warn(`[SimpleRuntimeManager] ⚠️ 警告: ${envKey} 未设置或无效`);
      }
    }
  }
  
  /**
   * 获取代理
   */
  getAgent(nameOrRef) {
    if (typeof nameOrRef === 'string') {
      return this.resources.agents.get(nameOrRef);
    } else if (nameOrRef && nameOrRef.name) {
      return this.resources.agents.get(nameOrRef.name);
    }
    return null;
  }
  
  /**
   * 获取工作流
   */
  getWorkflow(nameOrRef) {
    if (typeof nameOrRef === 'string') {
      return this.resources.workflows.get(nameOrRef);
    } else if (nameOrRef && nameOrRef.name) {
      return this.resources.workflows.get(nameOrRef.name);
    }
    return null;
  }
  
  /**
   * 执行代理
   * 这里简化实现，根据不同的代理类型返回模拟响应
   */
  async executeAgent(agentRef, input, options = {}) {
    // 获取代理
    const agent = this.getAgent(agentRef);
    const agentName = agent?.name || (typeof agentRef === 'string' ? agentRef : '未知代理');
    
    console.log(`[SimpleRuntimeManager] 执行代理: ${agentName}, 输入: ${input}`);
    
    if (!agent) {
      return `找不到代理: ${agentName}`;
    }
    
    // 检查环境变量
    const modelProvider = agent.spec.model?.provider || 'openai';
    const envKey = `${modelProvider.toUpperCase()}_API_KEY`;
    
    // 根据代理类型执行
    if (agentName === 'weather-agent' || (agent.tools && agent.tools['weather'])) {
      // 天气代理
      const cities = ["北京", "上海", "广州", "深圳", "杭州"];
      const city = cities.find(c => input.includes(c)) || "北京";
      const conditions = ['晴朗', '多云', '小雨', '大雨', '雷雨', '大风'];
      const temperatures = Array.from({ length: 10 }, (_, i) => 20 + i);
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      const randomTemperature = temperatures[Math.floor(Math.random() * temperatures.length)];
      
      return `${city}天气：${randomCondition}，温度：${randomTemperature}°C`;
    } else if (agentName === 'simple-agent') {
      // 简单代理
      if (input.includes("建议") && input.includes("天气")) {
        const weatherInfo = input.replace("根据天气信息生成建议: ", "");
        
        if (weatherInfo.includes("晴朗")) {
          return `天气${weatherInfo}，建议您外出活动，记得防晒！`;
        } else if (weatherInfo.includes("多云")) {
          return `天气${weatherInfo}，适合外出，但要注意随时可能变化的天气。`;
        } else if (weatherInfo.includes("雨")) {
          return `天气${weatherInfo}，建议您带伞出门，注意防滑。`;
        } else if (weatherInfo.includes("大风")) {
          return `天气${weatherInfo}，外出时注意安全，尽量避开广告牌等可能被风吹落的物体。`;
        }
      }
    } else if (agentName === 'qwen-agent') {
      // Qwen代理
      if (!process.env.QWEN_API_KEY || process.env.QWEN_API_KEY === 'sk-mock-key') {
        console.warn(`[SimpleRuntimeManager] Qwen API密钥未设置，使用模拟响应`);
        return `来自Qwen的模拟响应: ${input}`;
      }
      
      try {
        console.log(`[SimpleRuntimeManager] 尝试调用真实的Qwen API（需要设置QWEN_API_KEY环境变量）`);
        
        // 这里应该调用真实的Qwen API
        // 由于这是一个演示，我们返回模拟响应
        // 在实际应用中，这里应该使用fetch或axios调用API
        
        return `来自Qwen的模拟响应: ${input}`;
      } catch (error) {
        console.error(`[SimpleRuntimeManager] 调用Qwen API失败: ${error.message}`);
        return `调用Qwen失败: ${error.message}`;
      }
    }
    
    // 默认响应
    return `代理 ${agentName} 的响应: ${input}`;
  }
  
  /**
   * 执行工作流
   */
  async executeWorkflow(workflowRef, input) {
    // 获取工作流
    const workflow = this.getWorkflow(workflowRef);
    const workflowName = workflow?.name || (typeof workflowRef === 'string' ? workflowRef : '未知工作流');
    
    console.log(`[SimpleRuntimeManager] 执行工作流: ${workflowName}`);
    
    if (!workflow) {
      return {
        result: `找不到工作流: ${workflowName}`,
        completed: false,
        error: 'NOT_FOUND'
      };
    }
    
    // 执行工作流步骤
    try {
      // 查找初始步骤
      const initialStepId = workflow.spec.initialStep;
      let currentStep = workflow.steps.find(s => s.id === initialStepId);
      
      if (!currentStep) {
        throw new Error(`找不到初始步骤: ${initialStepId}`);
      }
      
      const executedSteps = [];
      let finalResult = null;
      
      // 执行工作流
      while (currentStep) {
        console.log(`[SimpleRuntimeManager] 执行步骤: ${currentStep.id} (${currentStep.name})`);
        
        // 构建步骤输入
        let stepInput;
        if (executedSteps.length === 0) {
          // 第一个步骤
          const location = input?.location || '北京';
          stepInput = `执行工作流步骤: ${currentStep.name}, 问题: ${location}`;
        } else {
          // 后续步骤，使用上一步的输出
          const previousOutput = executedSteps[executedSteps.length - 1].output;
          stepInput = `根据天气信息生成建议: ${previousOutput}`;
        }
        
        // 执行步骤
        const agent = currentStep.agent;
        const output = await this.executeAgent(agent, stepInput);
        
        // 记录步骤结果
        executedSteps.push({
          id: currentStep.id,
          name: currentStep.name,
          output: output
        });
        
        finalResult = output;
        
        // 查找下一步
        if (currentStep.next && currentStep.next !== 'END') {
          currentStep = workflow.steps.find(s => s.id === currentStep.next);
          if (!currentStep) {
            throw new Error(`找不到下一步: ${currentStep.next}`);
          }
        } else {
          // 工作流结束
          break;
        }
      }
      
      // 返回执行结果
      return {
        result: finalResult,
        completed: true,
        steps: executedSteps
      };
    } catch (error) {
      console.error(`[SimpleRuntimeManager] 执行工作流失败: ${error.message}`);
      return {
        result: `执行失败: ${error.message}`,
        completed: false,
        error: error.message
      };
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    console.log(`[SimpleRuntimeManager] 清理资源...`);
    
    this.resources.agents.clear();
    this.resources.tools.clear();
    this.resources.workflows.clear();
    
    return true;
  }
}

/**
 * 运行示例
 */
async function runSimpleExample() {
  console.log('启动简化版MastraPod示例');
  console.log('------------------------------------');
  
  // 设置模拟密钥
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-mock-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-mock-key';
  process.env.QWEN_API_KEY = process.env.QWEN_API_KEY || 'sk-mock-key';
  
  // 创建运行时
  const runtime = new SimpleRuntimeManager();
  
  try {
    // 加载配置
    const podPath = join(__dirname, 'mastrapod.yaml');
    const result = await runtime.loadPod(podPath);
    
    console.log('\n已加载配置:');
    console.log('- 提供商:', result.providers.join(', '));
    console.log('- 代理:', result.resources.agents.join(', '));
    console.log('- 工具:', result.resources.tools.join(', '));
    console.log('- 工作流:', result.resources.workflows.join(', '));
    console.log('------------------------------------\n');
    
    // 测试Qwen代理
    console.log('测试Qwen代理:');
    const qwenResponse = await runtime.executeAgent('qwen-agent', '你能介绍一下自己吗？请简短回答。');
    console.log(`Qwen回复: ${qwenResponse}\n`);
    
    const qwenWeatherResponse = await runtime.executeAgent('qwen-agent', '北京今天的天气怎么样？');
    console.log(`Qwen天气查询回复: ${qwenWeatherResponse}\n`);
    
    // 测试Qwen工作流
    console.log('测试Qwen工作流:');
    const qwenWorkflowResult = await runtime.executeWorkflow('qwen-workflow', { location: '上海' });
    console.log('Qwen工作流结果:');
    console.log(JSON.stringify(qwenWorkflowResult, null, 2));
    console.log();
    
    // 测试天气工作流
    console.log('测试天气工作流:');
    const weatherWorkflowResult = await runtime.executeWorkflow('weather-workflow', { location: '北京' });
    console.log('天气工作流结果:');
    console.log(JSON.stringify(weatherWorkflowResult, null, 2));
    console.log();
    
    // 测试简单代理
    console.log('测试简单代理:');
    const simpleAgentResponse = await runtime.executeAgent('simple-agent', '你能告诉我今天的天气吗?');
    console.log(`简单代理回复: ${simpleAgentResponse}\n`);
    
    console.log('示例执行完成');
    console.log('------------------------------------');
  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    // 清理资源
    runtime.cleanup();
  }
}

/**
 * 主函数
 */
function main() {
  // 显示使用信息
  console.log('MastraPod简化执行器');
  console.log('使用: node run-simple.js [options]');
  console.log('环境变量:');
  console.log('  QWEN_API_KEY     - 阿里千问API密钥');
  console.log('  OPENAI_API_KEY   - OpenAI API密钥');
  console.log('  ANTHROPIC_API_KEY - Anthropic API密钥');
  console.log('------------------------------------');
  
  // 运行示例
  runSimpleExample().catch(error => {
    console.error('运行出错:', error);
    process.exit(1);
  });
}

// 启动程序
main(); 