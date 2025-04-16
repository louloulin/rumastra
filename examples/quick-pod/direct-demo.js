/**
 * MastraPod 快速演示
 * 
 * 这是一个独立的演示脚本，模拟 MastraPod 的核心概念
 * 不依赖于安装 @mastra/runtimes 包
 */

import fs from 'fs';
import yaml from 'js-yaml';
import readline from 'readline';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 封装问答函数
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 模拟 MastraPod 类
class SimpleMastraPod {
  constructor() {
    this.resources = {
      Tool: new Map(),
      Agent: new Map(),
      Workflow: new Map()
    };
    
    this.tools = {
      search: async (query) => {
        console.log(`[Search] 搜索: ${query}`);
        return `这是关于 ${query} 的搜索结果`;
      },
      weather: async (city) => {
        console.log(`[Weather] 查询天气: ${city}`);
        // 模拟天气数据
        const conditions = ['晴天', '多云', '小雨', '大雨', '阴天'];
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        const temperature = Math.floor(15 + Math.random() * 20);
        return `${city}的天气: ${condition}, 温度 ${temperature}°C`;
      },
      calculate: async (expression) => {
        console.log(`[Calculator] 计算: ${expression}`);
        try {
          // 安全地计算表达式
          const sanitizedExpr = expression.replace(/[^0-9+\-*/.()\s]/g, '');
          const result = eval(sanitizedExpr);
          return `计算结果: ${expression} = ${result}`;
        } catch (error) {
          return `计算出错: ${error.message}`;
        }
      }
    };
  }
  
  // 加载配置文件
  async loadConfig(filePath) {
    console.log(`加载配置文件: ${filePath}`);
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContent);
      
      // 提取资源
      if (config.resources && Array.isArray(config.resources)) {
        for (const resource of config.resources) {
          if (!resource.kind || !resource.metadata || !resource.metadata.name) {
            console.warn('跳过无效资源:', resource);
            continue;
          }
          
          // 存储资源
          if (this.resources[resource.kind]) {
            this.resources[resource.kind].set(resource.metadata.name, resource);
            console.log(`加载 ${resource.kind}: ${resource.metadata.name}`);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('加载配置文件失败:', error);
      return false;
    }
  }
  
  // 获取所有工具
  getTools() {
    return Array.from(this.resources.Tool.values());
  }
  
  // 获取所有代理
  getAgents() {
    return Array.from(this.resources.Agent.values());
  }
  
  // 检查代理是否存在
  hasAgent(name) {
    return this.resources.Agent.has(name);
  }
  
  // 运行代理
  async runAgent(agentName, query) {
    const agent = this.resources.Agent.get(agentName);
    if (!agent) {
      throw new Error(`找不到代理: ${agentName}`);
    }
    
    console.log(`运行代理: ${agentName}`);
    console.log(`输入: ${query}`);
    
    // 分析查询，确定使用哪个工具
    let toolName = null;
    
    if (query.includes('天气') || query.includes('气温')) {
      toolName = 'weather';
      // 提取城市名
      const city = query.includes('在') 
        ? query.split('在')[1].split('的')[0] 
        : query.split('天气')[0].trim();
      
      // 调用天气工具
      const result = await this.tools.weather(city);
      return { result: { content: result } };
    } 
    else if (query.includes('计算') || query.match(/[0-9+\-*/]/)) {
      toolName = 'calculate';
      // 提取表达式
      const expr = query.includes('计算') 
        ? query.split('计算')[1].trim() 
        : query.match(/[0-9+\-*/.\s]+/)[0].trim();
      
      // 调用计算工具
      const result = await this.tools.calculate(expr);
      return { result: { content: result } };
    }
    else {
      toolName = 'search';
      // 调用搜索工具
      const result = await this.tools.search(query);
      return { result: { content: `根据你的问题"${query}"，我找到了以下信息：\n\n${result}\n\n希望这对你有所帮助！` } };
    }
  }
}

// 主函数
async function main() {
  // 打印欢迎信息
  console.log('==== MastraPod 快速演示 ====');
  console.log('一个简单的问答助手，模拟 MastraPod API 的基本用法');
  console.log('-------------------------------\n');
  
  try {
    // 创建 MastraPod 实例
    const pod = new SimpleMastraPod();
    
    // 配置文件路径
    const configPath = join(__dirname, 'config.yaml');
    
    // 加载配置
    const success = await pod.loadConfig(configPath);
    if (!success) {
      throw new Error('加载配置失败');
    }
    
    // 列出所有资源
    console.log('\n已加载的资源:');
    const tools = pod.getTools();
    console.log(`工具: ${tools.map(t => t.metadata.name).join(', ')}`);
    
    const agents = pod.getAgents();
    console.log(`代理: ${agents.map(a => a.metadata.name).join(', ')}`);
    
    // 获取问答助手
    console.log('\n获取问答助手...');
    const agentName = 'qa-agent';
    if (!pod.hasAgent(agentName)) {
      throw new Error(`找不到代理: ${agentName}`);
    }
    console.log(`已找到代理: ${agentName}`);
    
    // 交互式问答循环
    console.log('\n开始交互...');
    console.log('输入问题，或输入 "退出" 结束对话');
    console.log('示例问题:');
    console.log('1. 北京的天气怎么样？');
    console.log('2. 计算 10 + 20 * 3');
    console.log('3. 什么是量子计算？');
    
    let running = true;
    while (running) {
      // 获取用户输入
      const question = await askQuestion('\n> ');
      
      // 检查是否退出
      if (question.toLowerCase() === '退出' || 
          question.toLowerCase() === 'exit' || 
          question.toLowerCase() === 'quit') {
        running = false;
        continue;
      }
      
      try {
        console.log('正在思考...');
        // 使用 runAgent 方法
        const response = await pod.runAgent(agentName, question);
        
        // 提取回答内容
        const answer = response.result?.content || '无法获取回答';
        console.log(`\n回答: ${answer}`);
      } catch (error) {
        console.error('发生错误:', error.message);
      }
    }
    
    console.log('\n感谢使用 MastraPod 快速演示!');
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 关闭命令行接口
    rl.close();
  }
}

main().catch(error => {
  console.error('致命错误:', error);
  process.exit(1);
}); 