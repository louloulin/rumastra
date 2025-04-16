/**
 * CLI 运行时管理器使用示例
 * 
 * 本示例展示如何在代码中使用 CLIRuntimeManager 来管理和执行资源
 */

import { CLIRuntimeManager } from '../../src/core/cli-runtime-manager';
import { RuntimeResource, WorkflowResource } from '../../src/types';
import path from 'path';

async function runExample() {
  console.log('=== CLI 运行时管理器示例 ===');
  
  // 初始化 CLI 运行时管理器
  const cliManager = new CLIRuntimeManager();
  await cliManager.initialize();
  console.log('✅ 运行时管理器初始化完成');
  
  try {
    // 解析资源文件
    console.log('\n1. 解析资源文件');
    const agentPath = path.join(__dirname, 'resources/agents/weather-agent.yaml');
    const workflowPath = path.join(__dirname, 'resources/workflows/weather-workflow.yaml');
    
    const agentResource = await cliManager.parseFile(agentPath);
    console.log(`✅ 已解析代理资源：${agentResource.metadata.name}`);
    
    const workflowResource = await cliManager.parseFile(workflowPath) as WorkflowResource;
    console.log(`✅ 已解析工作流资源：${workflowResource.metadata.name}`);
    
    // 加载资源
    console.log('\n2. 加载资源到运行时');
    await cliManager.loadResource(agentResource);
    await cliManager.loadResource(workflowResource);
    console.log('✅ 资源加载完成');
    
    // 执行代理
    console.log('\n3. 执行代理');
    const agentInput = '北京的天气如何？';
    console.log(`输入: "${agentInput}"`);
    const agentResult = await cliManager.executeAgent('weather-agent', agentInput);
    console.log(`代理响应: "${agentResult}"`);
    
    // 执行工作流
    console.log('\n4. 执行工作流');
    await cliManager.executeWorkflow(workflowResource);
    console.log('✅ 工作流执行完成');
    
    // 解析 MastraPod
    console.log('\n5. 解析 MastraPod 文件');
    const podPath = path.join(__dirname, 'resources/pod.yaml');
    
    try {
      const podResult = await cliManager.parseMastraPod(podPath);
      console.log(`✅ 解析 MastraPod 完成，包含 ${podResult.resources.length} 个资源`);
      
      // 应用全局配置
      await cliManager.applyGlobalConfig(podResult.podConfig);
      console.log('✅ 应用全局配置完成');
      
      // 加载 Pod 中的资源
      for (const resource of podResult.resources) {
        await cliManager.loadResource(resource);
        console.log(`✅ 加载资源 ${resource.kind}/${resource.metadata.name}`);
      }
    } catch (error) {
      console.error(`❌ MastraPod 解析失败: ${(error as Error).message}`);
    }
    
    // 事件监听示例
    console.log('\n6. 事件监听示例');
    
    cliManager.on('workflow:start', (data) => {
      console.log(`📢 事件: 工作流 ${data.workflowId} 开始执行`);
    });
    
    cliManager.on('workflow:complete', (data) => {
      console.log(`📢 事件: 工作流 ${data.workflowId} 执行完成`);
    });
    
    cliManager.on('step:start', (data) => {
      console.log(`📢 事件: 步骤 ${data.stepId} 开始执行`);
    });
    
    cliManager.on('step:complete', (data) => {
      console.log(`📢 事件: 步骤 ${data.stepId} 执行完成`);
    });
    
    // 再次执行工作流，展示事件
    console.log('\n7. 再次执行工作流 (观察事件)');
    await cliManager.executeWorkflow(workflowResource);
    
  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  } finally {
    // 清理资源
    console.log('\n8. 清理资源');
    await cliManager.cleanup();
    console.log('✅ 资源清理完成');
  }
  
  console.log('\n示例执行完成!');
}

// 运行示例
runExample().catch(console.error); 