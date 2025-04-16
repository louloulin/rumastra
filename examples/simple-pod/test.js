#!/usr/bin/env node

/**
 * 综合测试文件
 * 用于验证MastraPod配置并执行示例
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义文本样式
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * 执行命令并打印结果
 */
function runCommand(command, options = {}) {
  console.log(`${styles.bright}${styles.blue}> ${command}${styles.reset}`);
  
  try {
    const output = execSync(command, {
      cwd: options.cwd || __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      ...options
    });
    
    console.log(output);
    return { success: true, output };
  } catch (error) {
    console.error(`${styles.red}命令执行失败:${styles.reset}`);
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return { success: false, error };
  }
}

/**
 * 打印测试结果
 */
function printTestResult(name, success) {
  const status = success
    ? `${styles.green}✓ 通过${styles.reset}`
    : `${styles.red}✗ 失败${styles.reset}`;
  
  console.log(`${styles.bright}测试: ${name}${styles.reset} - ${status}`);
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log(`\n${styles.bright}${styles.magenta}===== 开始 MastraPod 测试 =====${styles.reset}\n`);
  
  let allTestsPassed = true;
  const startTime = Date.now();
  
  // 测试1: 验证NPM依赖是否安装
  console.log(`\n${styles.cyan}[测试1] 检查依赖${styles.reset}`);
  try {
    const packageCheck = runCommand('npm list @mastra/runtimes --depth=0');
    printTestResult('依赖检查', packageCheck.success);
    allTestsPassed = allTestsPassed && packageCheck.success;
  } catch (error) {
    console.error(`${styles.red}检查依赖失败:${styles.reset}`, error);
    printTestResult('依赖检查', false);
    allTestsPassed = false;
  }
  
  // 测试2: 验证MastraPod配置
  console.log(`\n${styles.cyan}[测试2] 验证MastraPod配置${styles.reset}`);
  const validateResult = runCommand('node validate.js');
  printTestResult('配置验证', validateResult.success);
  allTestsPassed = allTestsPassed && validateResult.success;
  
  // 测试3: 确保工具实现文件存在
  console.log(`\n${styles.cyan}[测试3] 检查工具实现文件${styles.reset}`);
  const toolPath = path.join(__dirname, 'tools', 'calculator.js');
  const checkToolResult = runCommand(`ls -la ${toolPath}`);
  printTestResult('工具实现', checkToolResult.success);
  allTestsPassed = allTestsPassed && checkToolResult.success;
  
  // 测试4: 运行示例 (如果前面的测试都通过)
  if (allTestsPassed) {
    console.log(`\n${styles.cyan}[测试4] 运行MastraPod示例${styles.reset}`);
    try {
      // 这里我们使用 mock 模式运行示例，不真正调用 LLM API
      process.env.MASTRA_MOCK_MODE = 'true';
      process.env.OPENAI_API_KEY = 'sk-mock-key';
      process.env.ANTHROPIC_API_KEY = 'sk-mock-key';
      
      // 这里只执行验证，不实际运行示例，因为示例需要真实的LLM环境
      console.log(`${styles.yellow}注意: 仅执行验证，未实际运行示例${styles.reset}`);
      console.log(`${styles.yellow}如需运行完整示例，请使用: node index.js${styles.reset}`);
      
      // 运行验证
      const runResult = runCommand('node validate.js');
      printTestResult('示例验证', runResult.success);
      allTestsPassed = allTestsPassed && runResult.success;
    } catch (error) {
      console.error(`${styles.red}运行示例时出错:${styles.reset}`, error);
      printTestResult('示例运行', false);
      allTestsPassed = false;
    }
  } else {
    console.log(`\n${styles.yellow}跳过示例运行，因为前面的测试未通过${styles.reset}`);
  }
  
  // 打印总结果
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log(`\n${styles.bright}${styles.magenta}===== 测试完成 [耗时: ${duration}s] =====${styles.reset}`);
  console.log(`${styles.bright}总体结果: ${allTestsPassed 
    ? `${styles.green}全部通过 ✓${styles.reset}` 
    : `${styles.red}部分失败 ✗${styles.reset}`}`);
  
  process.exit(allTestsPassed ? 0 : 1);
}

// 运行测试
runTests().catch(error => {
  console.error(`${styles.red}测试过程发生异常:${styles.reset}`, error);
  process.exit(1);
}); 