/**
 * 工具执行器 - 提供安全执行JavaScript工具脚本的TypeScript接口
 */

import path from 'path';
import { promises as fs } from 'fs';
import { executeScript } from './scriptRunner';

// 定义工具执行函数类型
export type ToolExecuteFunction = (input: Record<string, any>) => Promise<any>;

/**
 * 创建工具执行函数
 * @param scriptPath 工具脚本路径
 * @returns 执行工具脚本的函数
 */
export async function createToolExecutor(scriptPath: string): Promise<ToolExecuteFunction> {
  const resolvedPath = path.resolve(scriptPath);
  
  // 检查脚本是否存在
  try {
    await fs.access(resolvedPath);
    console.log(`[ToolExecutor] Tool script found: ${resolvedPath}`);
  } catch (error) {
    throw new Error(`Tool script not found: ${resolvedPath}`);
  }
  
  // 返回执行脚本的函数
  return async function execute(input: Record<string, any>): Promise<any> {
    try {
      console.log(`[ToolExecutor] Executing tool script: ${resolvedPath}`);
      const result = await executeScript(resolvedPath, input);
      return result;
    } catch (error) {
      // 记录错误并抛出执行错误
      console.error(`[ToolExecutor] Execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to execute tool script: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

/**
 * 验证工具脚本是否包含必要的导出
 * @param scriptPath 工具脚本路径
 * @returns 脚本是否有效
 */
export async function validateToolScript(scriptPath: string): Promise<boolean> {
  const resolvedPath = path.resolve(scriptPath);
  
  try {
    // 检查文件是否存在
    await fs.access(resolvedPath);
    
    // 读取文件内容进行基本验证
    const content = await fs.readFile(resolvedPath, 'utf-8');
    
    // 检查是否包含execute函数
    const hasExecuteFunction = 
      content.includes('export async function execute') || 
      content.includes('exports.execute =') || 
      content.includes('module.exports.execute =');
    
    if (!hasExecuteFunction) {
      console.warn(`[ToolExecutor] Warning: Tool script may not have proper 'execute' export: ${resolvedPath}`);
    }
    
    console.log(`[ToolExecutor] Validated tool script: ${resolvedPath}`);
    return true;
  } catch (error) {
    console.error(`[ToolExecutor] Tool script validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
} 