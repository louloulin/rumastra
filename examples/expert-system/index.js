import { loadFromFile, RuntimeManager } from '@mastra/runtimes';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

// 加载环境变量
config();

/**
 * 客户支持专家系统示例
 * 演示如何使用 @mastra/runtimes 创建一个基于声明式配置的复杂AI系统
 */
async function main() {
  console.log('🚀 启动客户支持专家系统');
  
  // 步骤1: 加载配置文件
  console.log('📄 加载配置文件...');
  const configPath = path.join(process.cwd(), 'config.yaml');
  const runtimeManager = await loadFromFile(configPath);
  console.log('✅ 配置加载完成');
  
  // 选择模式
  console.log('\n请选择交互模式:');
  console.log('1. 工作流模式 - 按照预定义步骤执行');
  console.log('2. 网络模式 - 动态智能体协作');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('请输入您的选择 (1/2): ', async (answer) => {
    if (answer === '1') {
      await runWorkflowMode(runtimeManager, rl);
    } else if (answer === '2') {
      await runNetworkMode(runtimeManager, rl);
    } else {
      console.log('❌ 无效的选择，退出程序');
      rl.close();
      process.exit(0);
    }
  });
}

/**
 * 工作流模式 - 使用预定义工作流处理客户请求
 */
async function runWorkflowMode(runtimeManager, rl) {
  console.log('\n🔄 启动工作流模式');
  console.log('📋 使用客户入职工作流处理请求\n');
  
  try {
    // 获取工作流
    const workflow = runtimeManager.getWorkflow('support.customer-onboarding');
    
    console.log('👋 开始工作流执行...');
    
    // 执行工作流
    const result = await workflow.execute({
      // 如果需要，可以在这里提供初始输入
      // input: { ... }
      
      // 这个回调在每个步骤执行前触发
      onStepExecute: (stepId, input) => {
        console.log(`\n🔶 执行步骤: ${stepId}`);
        
        if (input.message) {
          console.log(`🤖 Agent: ${input.message}`);
        }
      },
      
      // 这个回调在收到每个步骤的输出时触发
      onStepOutput: (stepId, output) => {
        console.log(`✅ 步骤 ${stepId} 完成`);
        
        // 输出决策或者结果
        if (output.routeDecision) {
          console.log(`🔀 路由决定: ${output.routeDecision}`);
        }
        if (output.resolution) {
          console.log(`📝 解决方案: ${output.resolution}`);
        }
      }
    });
    
    console.log('\n✨ 工作流执行完成!');
    console.log('📊 最终结果:', result.output.finalResponse);
    
    rl.close();
  } catch (error) {
    console.error('❌ 工作流执行出错:', error);
    rl.close();
  }
}

/**
 * 网络模式 - 使用智能体网络动态处理客户请求
 */
async function runNetworkMode(runtimeManager, rl) {
  console.log('\n🌐 启动网络模式');
  console.log('🧠 使用智能体网络动态处理请求\n');
  
  try {
    // 获取网络
    const network = runtimeManager.getNetwork('support.support-network');
    
    // 创建交互式对话
    console.log('👋 欢迎使用客户支持系统! 请描述您的问题，输入 "exit" 结束对话。\n');
    
    // 对话循环
    const chat = async () => {
      rl.question('👤 您: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('👋 感谢使用客户支持系统，再见!');
          rl.close();
          return;
        }
        
        try {
          // 生成回复
          console.log('🤖 正在处理...');
          
          const result = await network.generate(input);
          
          console.log(`🤖 助手: ${result.text}\n`);
          
          // 显示当前网络状态
          console.log('📊 当前网络状态:');
          console.log(JSON.stringify(network.getState(), null, 2));
          console.log(`🔢 步骤计数: ${network.getStepCount()}\n`);
          
          // 继续对话
          chat();
        } catch (error) {
          console.error('❌ 生成回复时出错:', error);
          rl.close();
        }
      });
    };
    
    // 开始对话
    chat();
  } catch (error) {
    console.error('❌ 网络执行出错:', error);
    rl.close();
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 程序执行出错:', error);
}); 