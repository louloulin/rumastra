// scriptRunner.js - 用于安全执行外部JavaScript脚本的运行器

import { spawn } from 'child_process';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * 生成唯一的临时文件名
 * @returns {string} 唯一文件名
 */
function generateTempFilename() {
  return `tool-runner-${crypto.randomUUID()}.js`;
}

/**
 * 创建一个执行工具的包装脚本
 * @param {string} toolPath 工具脚本路径
 * @param {Object} input 输入参数
 * @returns {Promise<string>} 包装脚本路径
 */
async function createWrapperScript(toolPath, input) {
  // 创建临时文件
  const tempDir = os.tmpdir();
  let wrapperPath = path.join(tempDir, generateTempFilename());
  
  // 检查文件扩展名，判断是否为ESM模式
  const isESM = toolPath.endsWith('.mjs') || 
                toolPath.endsWith('.js') && 
                await isESModule(toolPath);
  
  // 选择适当的包装脚本内容
  let wrapperContent;
  
  if (isESM) {
    // ES Module包装脚本
    wrapperContent = `
      // 生成的临时ES Module包装脚本
      import { createRequire } from 'module';
      import * as path from 'path';
      import { fileURLToPath } from 'url';
      
      // 获取路径
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const require = createRequire(import.meta.url);
      
      // 工具路径和输入
      const toolPath = ${JSON.stringify(toolPath)};
      const input = ${JSON.stringify(input)};
      
      // 尝试加载工具模块
      try {
        // 导入ES Module工具
        const toolModule = await import(toolPath);
        
        // 检查模块是否包含执行函数
        if (typeof toolModule.execute !== 'function' && 
            (!toolModule.default || typeof toolModule.default.execute !== 'function')) {
          throw new Error('Tool module does not export an execute function');
        }
        
        // 获取执行函数
        const execute = typeof toolModule.execute === 'function' 
          ? toolModule.execute 
          : toolModule.default.execute;
          
        // 执行工具函数
        try {
          const result = await execute(input);
          // 输出结果到标准输出
          console.log('__TOOL_RESULT__' + JSON.stringify(result));
          process.exit(0);
        } catch (executeError) {
          console.error('__TOOL_ERROR__' + executeError.message);
          process.exit(1);
        }
      } catch (error) {
        console.error('__TOOL_ERROR__' + error.message);
        process.exit(1);
      }
    `;
    
    // 为ESM模式设置.mjs扩展名
    wrapperPath = wrapperPath.replace('.js', '.mjs');
  } else {
    // CommonJS包装脚本
    wrapperContent = `
      // 生成的临时包装脚本 (CommonJS)
      const fs = require('fs');
      const path = require('path');
      
      // 尝试加载工具模块
      try {
        // 读取要执行的工具脚本路径
        const toolPath = ${JSON.stringify(toolPath)};
        
        // 工具输入
        const input = ${JSON.stringify(input)};
        
        // 导入工具模块
        const toolModule = require(toolPath);
        
        // 检查模块是否包含执行函数
        if (typeof toolModule.execute !== 'function') {
          throw new Error('Tool module does not export an execute function');
        }
        
        // 执行工具函数
        const resultPromise = toolModule.execute(input);
        
        // 处理结果
        Promise.resolve(resultPromise)
          .then(result => {
            // 输出结果到标准输出
            console.log('__TOOL_RESULT__' + JSON.stringify(result));
            process.exit(0);
          })
          .catch(error => {
            console.error('__TOOL_ERROR__' + error.message);
            process.exit(1);
          });
      } catch (error) {
        console.error('__TOOL_ERROR__' + error.message);
        process.exit(1);
      }
    `;
  }
  
  // 写入包装脚本
  await fsPromises.writeFile(wrapperPath, wrapperContent, 'utf-8');
  
  return wrapperPath;
}

/**
 * 检查文件是否为ES Module
 * @param {string} filePath 文件路径
 * @returns {Promise<boolean>} 是否为ES Module
 */
async function isESModule(filePath) {
  try {
    // 读取文件内容
    const content = await fsPromises.readFile(filePath, 'utf-8');
    
    // ES Module通常具有import/export语句
    const hasImport = content.includes('import ');
    const hasExport = content.includes('export ');
    
    // 检查package.json是否设置了type=module
    let isPackageModule = false;
    try {
      // 尝试寻找最近的package.json
      const packagePath = findNearestPackageJson(filePath);
      if (packagePath) {
        const packageJson = JSON.parse(await fsPromises.readFile(packagePath, 'utf-8'));
        isPackageModule = packageJson.type === 'module';
      }
    } catch (error) {
      // 忽略package.json检查错误
    }
    
    return (hasImport && hasExport) || isPackageModule;
  } catch (error) {
    // 如果无法读取文件，假设为CommonJS
    return false;
  }
}

/**
 * 查找最近的package.json文件
 * @param {string} startPath 起始路径
 * @returns {string|null} package.json路径或null
 */
function findNearestPackageJson(startPath) {
  let currentDir = path.dirname(startPath);
  const root = path.parse(currentDir).root;
  
  // 向上查找package.json，直到找到根目录
  while (currentDir !== root) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return packagePath;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * 执行工具脚本
 * @param {string} toolPath 工具脚本路径
 * @param {Object} input 输入参数
 * @returns {Promise<Object>} 工具执行结果
 */
async function executeScript(toolPath, input) {
  try {
    // 解析工具脚本的绝对路径
    const resolvedToolPath = path.resolve(toolPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(resolvedToolPath)) {
      throw new Error(`Tool script not found: ${resolvedToolPath}`);
    }
    
    // 创建包装脚本
    const wrapperPath = await createWrapperScript(resolvedToolPath, input);
    const isESM = wrapperPath.endsWith('.mjs');
    
    // 收集的输出
    let stdoutData = '';
    let stderrData = '';
    
    // 根据脚本类型使用不同的执行命令
    const nodeArgs = isESM ? [wrapperPath] : [wrapperPath];
    
    console.log(`执行${isESM ? 'ES Module' : 'CommonJS'}工具脚本: ${resolvedToolPath}`);
    
    // 使用子进程执行包装脚本
    const childProcess = spawn('node', nodeArgs, {
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    // 收集标准输出
    childProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // 收集标准错误
    childProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // 处理执行结果
    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        // 清理临时文件
        fs.unlink(wrapperPath, () => {});
        
        if (code === 0) {
          // 查找并解析工具结果
          const resultMatch = stdoutData.match(/__TOOL_RESULT__(.*)/);
          if (resultMatch && resultMatch[1]) {
            try {
              const result = JSON.parse(resultMatch[1]);
              resolve(result);
            } catch (error) {
              reject(new Error(`Failed to parse tool result: ${error.message}`));
            }
          } else {
            reject(new Error('Tool execution did not produce a valid result'));
          }
        } else {
          // 查找错误信息
          const errorMatch = stderrData.match(/__TOOL_ERROR__(.*)/);
          const errorMsg = errorMatch ? errorMatch[1] : stderrData || 'Unknown error';
          reject(new Error(`Tool execution failed: ${errorMsg}`));
        }
      });
      
      // 处理进程错误
      childProcess.on('error', (error) => {
        // 清理临时文件
        fs.unlink(wrapperPath, () => {});
        reject(new Error(`Failed to execute tool script: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Failed to execute script: ${error.message}`);
  }
}

// 导出模块
export { executeScript }; 