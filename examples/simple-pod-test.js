// simple-pod-test.js - 测试 MastraPod API

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MastraPod } from '../dist/index.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 烹饪工具测试
async function testMastraPod() {
  try {
    console.log('===== 测试 MastraPod API =====');
    
    // 创建 MastraPod 实例
    const pod = new MastraPod();
    console.log('创建 MastraPod 实例成功');
    
    // 检查 API
    console.log('\n可用的 API 方法:');
    console.log(Object.keys(pod).filter(k => typeof pod[k] === 'function'));
    
    // 如果 pod 有 addTool 方法，添加烹饪工具
    if (typeof pod.addTool === 'function') {
      console.log('\n添加烹饪工具:');
      await pod.addTool({
        name: 'cooking-tool',
        description: '根据食材提供食谱建议',
        execute: './mock-cooking.js'
      });
      console.log('工具已添加');
      
      // 调用工具
      console.log('\n调用烹饪工具:');
      const result = await pod.callTool('cooking-tool', {
        ingredients: ['鸡蛋', '面粉', '牛奶']
      });
      console.log('工具返回结果:', result);
    } else {
      console.log('\n该版本 MastraPod API 不支持 addTool 方法');
    }
    
    console.log('\n===== 测试完成 =====');
  } catch (error) {
    console.error('测试出错:', error);
  }
}

// 运行测试
testMastraPod().catch(console.error); 