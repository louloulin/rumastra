#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CLIRuntimeManager } from 'rumastra';

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
      namespace: 'default'
    };
  }
  
  // 确保metadata有name
  if (!resource.metadata.name) {
    resource.metadata.name = resource.spec?.name || 'unknown';
  }
  
  // 确保metadata有namespace
  if (!resource.metadata.namespace) {
    resource.metadata.namespace = 'default';
  }
  
  return resource;
}

/**
 * 创建一个定制的RuntimeManager，完全解决metadata问题
 */
class ModifiedRuntimeManager extends CLIRuntimeManager {
  constructor() {
    super();
    console.log('[ModifiedRuntimeManager] 初始化');
  }
  
  async initialize() {
    await super.initialize();
    console.log('[ModifiedRuntimeManager] 已初始化，开始打补丁');
    
    // 修改事件总线
    this.patchEventBus();
    
    // 修改控制器
    this.patchControllers();
    
    console.log('[ModifiedRuntimeManager] 所有补丁已应用');
  }
  
  patchEventBus() {
    if (!this.runtimeManager || !this.runtimeManager.eventBus) {
      console.log('[ModifiedRuntimeManager] 无法找到事件总线');
      return;
    }
    
    const eventBus = this.runtimeManager.eventBus;
    const originalPublish = eventBus.publish;
    
    // 修改publish方法以确保event中的resource有metadata
    eventBus.publish = function(eventType, data) {
      // 处理订阅者接收到的数据
      if (data && typeof data === 'object') {
        // 检查是否有resource字段
        if (data.resource) {
          ensureMetadata(data.resource);
        }
        
        // 检查是否有event字段，通常在reconcile事件中
        if (data.event && data.event.resource) {
          ensureMetadata(data.event.resource);
        }
      }
      
      // 调用原始的publish方法
      return originalPublish.call(this, eventType, data);
    };
    
    console.log('[ModifiedRuntimeManager] 事件总线已修补');
  }
  
  patchControllers() {
    if (!this.runtimeManager || !this.runtimeManager.controllers) {
      console.log('[ModifiedRuntimeManager] 无法找到控制器集合');
      return;
    }
    
    // 修补Agent控制器
    if (this.runtimeManager.controllers.has('Agent')) {
      const agentController = this.runtimeManager.controllers.get('Agent');
      const originalReconcile = agentController.reconcile;
      
      agentController.reconcile = async function(resource) {
        // 确保resource有完整的metadata
        ensureMetadata(resource);
        
        // 调用原始的reconcile方法
        return await originalReconcile.call(this, resource);
      };
      
      console.log('[ModifiedRuntimeManager] Agent控制器已修补');
    }
    
    // 修补RuntimeManager的handleAgentReconciled方法
    if (this.runtimeManager.handleAgentReconciled) {
      const originalHandleAgentReconciled = this.runtimeManager.handleAgentReconciled;
      
      this.runtimeManager.handleAgentReconciled = function(event) {
        try {
          // 确保event有效
          if (!event) {
            console.log('[ModifiedRuntimeManager] 事件对象为空');
            return;
          }
          
          // 确保event.resource有效
          if (!event.resource) {
            console.log('[ModifiedRuntimeManager] 事件中的资源对象为空');
            event.resource = { 
              metadata: { name: 'unknown', namespace: 'default' }
            };
          }
          
          // 确保resource有metadata
          ensureMetadata(event.resource);
          
          // 调用原始方法
          return originalHandleAgentReconciled.call(this, event);
        } catch (error) {
          console.log('[ModifiedRuntimeManager] 处理事件时出错:', error.message);
        }
      };
      
      console.log('[ModifiedRuntimeManager] handleAgentReconciled方法已修补');
    }
  }
  
  async loadResource(resource) {
    // 确保resource有完整的metadata
    ensureMetadata(resource);
    
    // 处理嵌套引用
    if (resource.spec) {
      // Agent中的tools
      if (resource.kind === 'Agent' && resource.spec.tools) {
        for (const toolName in resource.spec.tools) {
          const tool = resource.spec.tools[toolName];
          if (typeof tool === 'object') {
            ensureMetadata(tool);
          }
        }
      }
      
      // Workflow中的steps中的agent引用
      if (resource.kind === 'Workflow' && resource.spec.steps) {
        for (const step of resource.spec.steps) {
          if (step.agent && typeof step.agent === 'object') {
            ensureMetadata(step.agent);
          }
        }
      }
    }
    
    console.log(`[ModifiedRuntimeManager] 加载资源: ${resource.kind}/${resource.metadata.name}`);
    
    // 调用原始的loadResource方法
    return await super.loadResource(resource);
  }
  
  // 包装executeAgent方法模拟代理响应
  async executeAgent(resource, input) {
    const agentName = typeof resource === 'string' ? resource : resource.metadata.name;
    console.log(`执行代理: ${agentName}, 输入: ${input}`);
    
    // 如果是weather-agent，提供天气信息
    if (agentName === 'weather-agent') {
      // 天气信息处理
      if (input.toLowerCase().includes("天气") || input.toLowerCase().includes("weather")) {
        const cities = ["北京", "上海", "广州", "深圳", "杭州"];
        const city = cities.find(c => input.includes(c)) || "北京";
        
        // 随机天气数据
        const conditions = ['晴朗', '多云', '小雨', '大雨', '雷雨', '大风'];
        const temperatures = Array.from({ length: 10 }, (_, i) => 20 + i);
        
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
        const randomTemperature = temperatures[Math.floor(Math.random() * temperatures.length)];
        
        return `${city}天气：${randomCondition}，温度：${randomTemperature}°C`;
      }
    }
    
    // 如果是simple-agent，给出建议
    if (agentName === 'simple-agent') {
      if (input.includes("建议")) {
        const weatherInfo = input.replace("根据天气信息生成建议: ", "");
        
        // 根据天气信息生成建议
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
      
      // 如果是位置查询
      if (input.includes("位置") || input.includes("location")) {
        return "您的位置是北京市海淀区中关村";
      }
    }
    
    return `模拟代理响应: ${input}`;
  }
  
  // 包装executeWorkflow方法模拟工作流执行
  async executeWorkflow(resource, input) {
    console.log(`执行工作流: ${resource.metadata.name}`);
    
    // 查找工作流中使用的Agent
    const initialStep = resource.spec.steps?.find(s => s.id === resource.spec.initialStep);
    if (initialStep && initialStep.agent) {
      const agentResponse = await this.executeAgent(initialStep.agent, 
        `执行工作流步骤: ${initialStep.name}, 问题: ${input?.location || '请问北京的天气如何？'}`);
      
      // 执行下一个步骤
      const nextStep = resource.spec.steps?.find(s => s.id === initialStep.next);
      let finalResult = agentResponse;
      
      if (nextStep && nextStep.agent) {
        finalResult = await this.executeAgent(nextStep.agent, 
          `根据天气信息生成建议: ${agentResponse}`);
      }
      
      return { 
        result: finalResult,
        completed: true,
        steps: [
          {id: initialStep.id, output: agentResponse},
          nextStep ? {id: nextStep.id, output: finalResult} : null
        ].filter(Boolean)
      };
    }
    
    return { result: "工作流执行结果", completed: true };
  }
}

/**
 * 演示如何使用MastraPod
 */
async function runModifiedExample() {
  console.log('启动修改版 MastraPod 示例 - 完全解决metadata问题...');
  
  // 设置环境变量
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-mock-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-mock-key';
  process.env.QWEN_API_KEY = process.env.QWEN_API_KEY || 'sk-mock-key';
  
  // 创建修改版RuntimeManager
  const runtimeManager = new ModifiedRuntimeManager();
  
  try {
    // 初始化运行时
    await runtimeManager.initialize();
    
    // MastraPod文件路径
    const podPath = join(__dirname, 'mastrapod.yaml');
    console.log(`加载MastraPod配置文件: ${podPath}`);
    
    // 解析MastraPod配置
    const { podConfig, resources } = await runtimeManager.parseMastraPod(podPath);
    
    // 预处理所有资源的metadata
    resources.forEach(resource => {
      ensureMetadata(resource);
      console.log(`预处理资源: ${resource.kind}/${resource.metadata.name}`);
    });
    
    // 应用全局配置
    await runtimeManager.applyGlobalConfig(podConfig);
    console.log('已应用全局配置');
    
    // 加载所有资源
    console.log(`准备加载 ${resources.length} 个资源...`);
    for (const resource of resources) {
      try {
        // 加载资源
        await runtimeManager.loadResource(resource);
        console.log(`已加载: ${resource.kind}/${resource.metadata.name}`);
      } catch (error) {
        console.error(`加载资源失败 ${resource.kind}/${resource.metadata?.name || 'unknown'}: ${error.message}`);
      }
    }
    
    // 测试Qwen代理
    const qwenAgent = resources.find(r => r.kind === 'Agent' && r.metadata.name === 'qwen-agent');
    if (qwenAgent) {
      console.log('与Qwen代理对话...');
      const response = await runtimeManager.executeAgent(qwenAgent, '你能介绍一下自己吗？请简短回答。');
      console.log(`Qwen代理回复:\n${response}`);
      
      // 测试天气查询
      const weatherResponse = await runtimeManager.executeAgent(qwenAgent, '北京今天的天气怎么样？');
      console.log(`Qwen天气查询回复:\n${weatherResponse}`);
    }
    
    // 执行Qwen工作流
    const qwenWorkflow = resources.find(r => r.kind === 'Workflow' && r.metadata.name === 'qwen-workflow');
    if (qwenWorkflow) {
      console.log('执行Qwen工作流...');
      const result = await runtimeManager.executeWorkflow(qwenWorkflow, { location: "上海" });
      console.log('Qwen工作流执行结果:', result);
    }
    
    // 找到并执行常规工作流
    const workflow = resources.find(r => r.kind === 'Workflow' && r.metadata.name === 'weather-workflow');
    if (workflow) {
      console.log('执行天气工作流...');
      const result = await runtimeManager.executeWorkflow(workflow, { location: "北京" });
      console.log('工作流执行结果:', result);
    }
    
    // 直接调用智能体
    const agent = resources.find(r => r.kind === 'Agent' && r.metadata.name === 'simple-agent');
    if (agent) {
      console.log('与智能体对话...');
      const response = await runtimeManager.executeAgent(agent, '你能告诉我今天的天气吗?');
      console.log(`智能体回复: ${response}`);
    }
    
    console.log('示例运行完成');
  } catch (error) {
    console.error('运行示例时出错:', error);
  } finally {
    try {
      // 清理资源
      await runtimeManager.cleanup();
      console.log('资源已清理');
    } catch (error) {
      console.error('清理资源时出错:', error);
    }
  }
}

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行示例
runModifiedExample().catch(error => {
  console.error('运行失败:', error);
  process.exit(1);
}); 