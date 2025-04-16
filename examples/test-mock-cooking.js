// test-mock-cooking.js
// 测试烹饪工具

import { execute } from './mock-cooking.js';

async function testCookingTool() {
  console.log('===== 测试烹饪工具 =====');
  
  // 测试案例1: 匹配奶酪三明治
  const test1 = { ingredients: ['面包', '奶酪'] };
  console.log('\n测试案例1:', test1);
  const result1 = await execute(test1);
  console.log('结果:', result1);
  
  // 测试案例2: 匹配炒鸡蛋
  const test2 = { ingredients: ['鸡蛋', '油', '葱'] };
  console.log('\n测试案例2:', test2);
  const result2 = await execute(test2);
  console.log('结果:', result2);
  
  // 测试案例3: 无匹配
  const test3 = { ingredients: ['西红柿', '黄瓜'] };
  console.log('\n测试案例3:', test3);
  const result3 = await execute(test3);
  console.log('结果:', result3);
}

// 运行测试
testCookingTool().catch(error => {
  console.error('测试失败:', error);
}); 