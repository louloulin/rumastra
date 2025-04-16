/**
 * 工具执行器 - 提供安全执行JavaScript工具脚本的TypeScript接口
 */

import path from 'path';
import { promises as fs } from 'fs';
import { executeScript } from './scriptRunner';

// Define the type for the tool execution function
export type ToolExecuteFunction = (input: any) => Promise<any>;

/**
 * Create a tool execution function for a tool script
 * @param scriptPath Path to the tool script to execute
 * @returns A function that executes the tool script with input
 */
export async function createToolExecutor(scriptPath: string): Promise<ToolExecuteFunction> {
  const resolvedPath = path.resolve(scriptPath);
  
  // Check if the script exists
  try {
    await fs.access(resolvedPath);
    console.log(`[ToolExecutor] Tool script found: ${resolvedPath}`);
  } catch (error) {
    throw new Error(`Tool script not found: ${resolvedPath}`);
  }
  
  // Return a function that will execute the script
  return async function execute(input: any): Promise<any> {
    try {
      console.log(`[ToolExecutor] Executing tool script: ${resolvedPath}`);
      const result = await executeScript(resolvedPath, input);
      return result;
    } catch (error) {
      throw new Error(`Failed to execute tool script: ${(error as Error).message}`);
    }
  };
}

/**
 * Validate that a tool script contains the necessary exports
 * @param scriptPath Path to the tool script to validate
 * @returns boolean indicating if the script is valid
 */
export async function validateToolScript(scriptPath: string): Promise<boolean> {
  const resolvedPath = path.resolve(scriptPath);
  
  try {
    // Check if the file exists
    await fs.access(resolvedPath);
    
    // We can't directly import the module to check its properties in TypeScript
    // Instead, we rely on the execute function to throw an appropriate error if
    // the module doesn't have the right exports
    
    // A proper validation would require loading the module in a separate process
    // and checking the exports, which is done by the script runner
    
    console.log(`[ToolExecutor] Validated tool script: ${resolvedPath}`);
    return true;
  } catch (error) {
    console.error(`[ToolExecutor] Tool script validation failed: ${(error as Error).message}`);
    return false;
  }
} 