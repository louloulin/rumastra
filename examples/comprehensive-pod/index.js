import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CLIRuntimeManager } from '../../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 全功能 MastraPod 示例
 * 
 * 此示例展示如何使用 Mastra Runtime 加载和运行一个包含
 * 全面功能的 MastraPod 配置。
 */
async function runComprehensivePodExample() {
  console.log('=== 启动全功能 MastraPod 示例 ===\n');
  
  // 设置环境变量
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-mock-openai-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-mock-anthropic-key';
  process.env.MEMORY_URL = process.env.MEMORY_URL || 'http://localhost:8000';
  process.env.DB_USERNAME = process.env.DB_USERNAME || 'db_user';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'db_password';
  process.env.ENABLE_CUSTOM_TOOLS = 'true';
  
  // 创建CLI运行时管理器
  const runtimeManager = new CLIRuntimeManager();
  
  try {
    // 初始化运行时
    console.log('初始化 Mastra Runtime...');
    await runtimeManager.initialize();
    
    // MastraPod文件路径
    const podPath = join(__dirname, 'mastrapod.yaml');
    console.log(`加载MastraPod配置文件: ${podPath}`);
    
    // 解析MastraPod配置
    const { podConfig, resources } = await runtimeManager.parseMastraPod(podPath);
    
    // 应用全局配置
    await runtimeManager.applyGlobalConfig(podConfig);
    console.log('已应用全局配置');
    
    // 存储代理资源，以便后续手动处理
    const agentResources = resources.filter(r => r.kind === 'Agent');
    
    // 加载所有资源
    console.log(`\n准备加载 ${resources.length} 个资源...`);
    for (const resource of resources) {
      // 特殊处理Agent类型资源
      if (resource.kind === 'Agent') {
        console.log(`特殊处理: ${resource.kind}/${resource.metadata.name}`);
        // 手动注册代理
        registerAgentManually(runtimeManager, resource);
        continue;
      }
      
      try {
        await runtimeManager.loadResource(resource);
        console.log(`已加载: ${resource.kind}/${resource.metadata.name}`);
      } catch (error) {
        console.error(`Failed to load resource ${resource.kind}/${resource.metadata.name}: ${error.message}`);
      }
    }
    
    // 展示资源统计
    const resourceTypes = resources.reduce((acc, r) => {
      acc[r.kind] = (acc[r.kind] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n资源类型统计:');
    Object.entries(resourceTypes).forEach(([kind, count]) => {
      console.log(`- ${kind}: ${count} 个资源`);
    });
    
    // 执行数据分析工作流示例
    const workflow = resources.find(r => r.kind === 'Workflow' && r.metadata.name === 'data-analysis-workflow');
    if (workflow) {
      console.log('\n执行数据分析工作流...');
      const result = await mockExecuteWorkflow(workflow);
      console.log('工作流执行结果:');
      console.log(result);
    }
    
    // 与智能助手代理互动
    const agent = resources.find(r => r.kind === 'Agent' && r.metadata.name === 'assistant-agent');
    if (agent) {
      console.log('\n与智能助手对话...');
      const queries = [
        '请查询北京的天气',
        '帮我分析一下销售数据的趋势'
      ];
      
      for (const query of queries) {
        console.log(`\n用户: ${query}`);
        try {
          // 直接使用代理名称调用executeAgent
          const response = await runtimeManager.executeAgent(agent.metadata.name, query);
          console.log(`智能助手: ${response}`);
        } catch (error) {
          console.error(`执行代理出错: ${error.message}`);
        }
      }
    }
    
    console.log('\n=== 示例运行完成 ===');
  } catch (error) {
    console.error('运行示例时出错:', error);
    console.error(error.stack);
  } finally {
    // 清理资源
    await runtimeManager.cleanup();
  }
}

/**
 * 手动注册代理资源
 * @param {Object} runtimeManager 运行时管理器
 * @param {Object} agentResource 代理资源
 */
function registerAgentManually(runtimeManager, agentResource) {
  // 创建一个模拟的代理对象
  const mockAgent = {
    name: agentResource.metadata.name,
    description: agentResource.spec.name,
    generate: async (input) => {
      // 根据不同的输入返回预设的回答
      if (input.includes('天气')) {
        return {
          text: `北京今天晴朗，气温25°C，微风。根据您的查询，我已使用天气工具获取最新信息。`
        };
      } else if (input.includes('销售数据') || input.includes('分析')) {
        return {
          text: `销售数据显示上升趋势，本月比上月增长15%。主要增长来自电子产品类别，增长了23%。`
        };
      } else {
        return {
          text: `您好，我是${agentResource.spec.name}。您可以向我咨询天气情况或销售数据分析。`
        };
      }
    }
  };
  
  // 将代理对象添加到运行时管理器
  runtimeManager.addAgent(agentResource.metadata.name, mockAgent);
  console.log(`已注册模拟代理: ${agentResource.metadata.name}`);
}

/**
 * 模拟执行工作流
 * @param {Object} workflow 工作流资源
 * @returns {Promise<Object>} 执行结果
 */
async function mockExecuteWorkflow(workflow) {
  console.log(`模拟执行工作流: ${workflow.metadata.name}`);
  
  // 记录步骤执行
  const steps = workflow.spec.steps || [];
  const results = [];
  
  for (const step of steps) {
    console.log(`执行步骤: ${step.id}`);
    
    // 模拟步骤执行延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 根据步骤ID生成不同的模拟结果
    let result;
    if (step.id === 'query-data') {
      result = {
        sales: [
          { month: '1月', amount: 1250000 },
          { month: '2月', amount: 1320000 },
          { month: '3月', amount: 1480000 }
        ],
        categories: ['电子产品', '服装', '食品']
      };
    } else if (step.id === 'analyze-data') {
      result = '销售数据分析结果：总体呈上升趋势，环比增长12.1%，其中电子产品类别表现最好。';
    } else if (step.id === 'summarize-results') {
      result = [
        '销售额持续增长，第一季度同比增长15%',
        '电子产品是最大增长点，贡献了总增长的60%',
        '服装类销售略有下降，需要加强促销策略',
        '食品类稳定增长，保持了8%的增长率'
      ];
    } else {
      result = `步骤 ${step.id} 的默认结果`;
    }
    
    results.push({
      stepId: step.id,
      output: result,
      timestamp: new Date().toISOString()
    });
  }
  
  return {
    workflowId: workflow.metadata.name,
    status: 'completed',
    steps: results,
    output: results[results.length - 1]?.output || '工作流执行完成',
    executionTime: `${steps.length * 500}ms`
  };
}

// 运行示例
runComprehensivePodExample().catch(console.error); 