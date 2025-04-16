#!/usr/bin/env node

/**
 * 测试@mastra/runtimes包API
 */

const { MastraPod } = require('@mastra/runtimes');

// 初始化
async function main() {
  try {
    // 创建MastraPod实例
    const mastraPod = new MastraPod({
      id: 'test-instance',
      enableLogging: true,
    });
    
    // 检查API方法
    console.log('MastraPod 实例可用方法:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(mastraPod))
      .filter(name => typeof mastraPod[name] === 'function' && name !== 'constructor');
    console.log(methods);
    
    // 测试获取资源
    console.log('\n尝试获取资源:');
    if (mastraPod.getResource) {
      try {
        const result = await mastraPod.getResource('Agent', 'task-assistant');
        console.log('getResource 结果:', result);
      } catch (err) {
        console.log('getResource 错误:', err.message);
      }
    } else {
      console.log('getResource 方法不可用');
    }
    
    // 测试调用工具
    console.log('\n尝试调用工具:');
    if (mastraPod.callTool) {
      try {
        const result = await mastraPod.callTool('task-manager', 'createTask', {
          title: '测试任务',
          description: '这是一个测试任务',
          priority: 'high'
        });
        console.log('callTool 结果:', result);
      } catch (err) {
        console.log('callTool 错误:', err.message);
      }
    } else {
      console.log('callTool 方法不可用');
    }
    
    // 测试运行代理
    console.log('\n尝试运行代理:');
    if (mastraPod.runAgent) {
      try {
        const result = await mastraPod.runAgent('task-assistant', { 
          input: '我需要安排一个会议' 
        });
        console.log('runAgent 结果:', result);
      } catch (err) {
        console.log('runAgent 错误:', err.message);
      }
    } else {
      console.log('runAgent 方法不可用');
    }
    
    // 测试运行工作流
    console.log('\n尝试运行工作流:');
    if (mastraPod.runWorkflow) {
      try {
        const result = await mastraPod.runWorkflow('task-processing-workflow', {
          title: '测试工作流任务',
          description: '这是一个通过工作流创建的测试任务',
          priority: 'medium'
        });
        console.log('runWorkflow 结果:', result);
      } catch (err) {
        console.log('runWorkflow 错误:', err.message);
      }
    } else {
      console.log('runWorkflow 方法不可用');
    }
    
    console.log('\n测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

main().catch(console.error); 