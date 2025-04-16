#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 检查必要的参数
if (!process.env.QWEN_API_KEY) {
  console.log('请提供QWEN_API_KEY环境变量。运行方式：');
  console.log('QWEN_API_KEY=your-api-key node run-with-qwen.js');
  process.exit(1);
}

// 可选的基础URL
if (!process.env.QWEN_API_BASE_URL) {
  console.log('未提供QWEN_API_BASE_URL环境变量，将使用默认API端点。');
}

console.log('=========================================');
console.log('🤖 Qwen 模型测试启动');
console.log('=========================================');

// 执行主脚本
try {
  // 调用index.js，保持环境变量
  execSync('node index.js', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // 确保环境变量被传递
      QWEN_API_KEY: process.env.QWEN_API_KEY,
      QWEN_API_BASE_URL: process.env.QWEN_API_BASE_URL
    }
  });
} catch (error) {
  console.error('执行失败:', error.message);
  process.exit(1);
} 