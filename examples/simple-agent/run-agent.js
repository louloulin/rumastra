import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadMastraFromFile } from '../../dist/index.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 简单代理示例，展示如何使用 rumastra
 * 创建和运行一个拥有工具的智能代理
 */
async function runSimpleAgentExample() {
  console.log('=== 启动简单代理示例 ===');
  
  try {
    // MastraPod文件路径
    const podPath = join(__dirname, 'pod.yaml');
    console.log(`加载MastraPod配置文件: ${podPath}`);
    
    // 从文件加载Mastra实例
    const mastra = await loadMastraFromFile(podPath, __dirname);
    console.log('已加载Mastra实例');
    
    // 列出所有agents的属性以查看
    console.log('检查Mastra对象属性:');
    console.log(Object.keys(mastra));
    
    // 检查Mastra对象的内容
    console.log('Mastra对象内容:');
    for (const key of Object.keys(mastra)) {
      console.log(`${key}: ${typeof mastra[key]}`);
      if (typeof mastra[key] === 'object' && mastra[key] !== null) {
        console.log(`  子属性: ${Object.keys(mastra[key])}`);
      }
    }
    
    // 检查所有已注册的代理
    try {
      console.log('\n检查已注册的代理:');
      // 如果有getAgents方法
      if (typeof mastra.getAgents === 'function') {
        const agents = mastra.getAgents();
        console.log('代理列表:', agents.map(a => a.name || a.metadata?.name));
      } else if (mastra.agents) {
        // 如果有agents对象
        console.log('代理列表:', Object.keys(mastra.agents));
      } else if (typeof mastra.listAgents === 'function') {
        // 如果有listAgents方法
        const agents = mastra.listAgents();
        console.log('代理列表:', agents);
      } else {
        // 尝试打印整个mastra对象来查看结构
        console.log('Mastra对象结构:', JSON.stringify(mastra, null, 2).substring(0, 500) + '...');
      }
    } catch (e) {
      console.log('获取代理列表失败:', e.message);
    }
    
    // 尝试获取默认代理
    try {
      const defaultAgent = mastra.getAgent('default');
      console.log('找到默认代理:', defaultAgent ? '成功' : '失败');
    } catch (e) {
      console.log('获取默认代理失败:', e.message);
    }
    
    // 获取代理
    const agent = mastra.getAgent('assistant-agent');
    if (!agent) {
      throw new Error('无法找到assistant-agent');
    }
    console.log('已找到代理: assistant-agent');
    
    // 聊天消息模板
    const messages = [
      { role: 'system', content: '你现在是一个有用的助手，可以使用工具来帮助回答问题。' },
      { role: 'user', content: '请计算 123 加 456 的结果。' },
    ];
    
    console.log('\n发送消息: 请计算 123 加 456 的结果');
    // 使用代理处理消息
    const response = await agent.chat(messages);
    console.log('\n代理回复:');
    console.log(response.message.content);
    
    // 再提一个使用搜索工具的问题
    console.log('\n发送消息: 给我讲讲人工智能');
    const response2 = await agent.chat([
      ...messages,
      { role: 'assistant', content: response.message.content },
      { role: 'user', content: '给我讲讲人工智能' }
    ]);
    console.log('\n代理回复:');
    console.log(response2.message.content);
    
    console.log('\n=== 示例运行完成 ===');
  } catch (error) {
    console.error('运行示例时出错:', error);
  }
}

// 运行示例
runSimpleAgentExample().catch(console.error); 