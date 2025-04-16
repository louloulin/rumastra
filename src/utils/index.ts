// 导出错误处理
export * from './errors';

// 导出工具函数
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConfigError } from './errors';

/**
 * 动态导入模块
 * @param modulePath 模块路径
 * @param basePath 基础路径
 * @returns 导入的模块
 */
export async function dynamicImport(modulePath: string, basePath: string = process.cwd()): Promise<any> {
  try {
    // 如果是相对路径，进行解析
    const resolvedPath = modulePath.startsWith('.')
      ? path.resolve(basePath, modulePath)
      : modulePath;
    
    // 动态导入模块
    return await import(resolvedPath);
  } catch (error) {
    throw new ConfigError(`Failed to import module: ${modulePath}`, { error, basePath });
  }
}

/**
 * 生成唯一ID
 * @param prefix ID前缀
 * @returns 唯一ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${prefix}${timestamp}-${randomStr}`;
}

/**
 * 检查路径是否存在
 * @param filePath 文件路径
 * @returns 是否存在
 */
export function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 确保目录存在
 * @param dirPath 目录路径
 * @returns 是否创建了目录
 */
export function ensureDir(dirPath: string): boolean {
  if (!pathExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * 清理路径，将反斜杠转换为正斜杠，并解析相对路径
 * @param filePath 文件路径
 * @returns 清理后的路径
 */
export function cleanPath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 深度合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
export function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

/**
 * 判断是否为对象
 * @param item 检查项
 * @returns 是否为对象
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
} 