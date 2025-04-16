/**
 * MastraPod 快速示例
 * 
 * 此示例展示了如何使用简化的 MastraPod API 创建一个基础的问答助手。
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import { MastraPod, loadFile } from 'kastra';

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

async function main() {
  // 打印欢迎信息
  console.log('==== MastraPod 快速示例 ====');
  console.log('一个简单的问答助手，展示 MastraPod API 的基本用法');
  console.log('-------------------------------\n');
  
  try {
    // 配置文件路径
    const configPath = join(__dirname, 'config.yaml');
    console.log(`加载配置文件: ${configPath}`);
    
    // 使用 loadFile 加载 MastraPod
    const pod = await loadFile(configPath, {
      env: process.env // 使用环境变量
    });
    
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
        const answer = response.result?.content || response.result || '无法获取回答';
        console.log(`\n回答: ${answer}`);
      } catch (error) {
        console.error('发生错误:', error.message);
      }
    }
    
    console.log('\n感谢使用 MastraPod 快速示例!');
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