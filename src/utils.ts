import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';

/**
 * 动态导入模块
 * @param modulePath 模块路径
 * @param basePath 基础路径，用于解析相对路径
 * @returns 导入的模块
 */
export async function dynamicImport(modulePath: string, basePath: string = process.cwd()): Promise<any> {
  try {
    // 处理相对路径
    let resolvedPath = modulePath;
    if (modulePath.startsWith('.')) {
      resolvedPath = path.resolve(basePath, modulePath);
    }

    console.log(`正在导入模块: ${resolvedPath}`);

    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Module not found: ${resolvedPath}`);
    }

    // 根据文件扩展名处理不同类型的文件
    const ext = path.extname(resolvedPath);
    
    // 对于 .js 文件，尝试直接读取文件并解析内容
    if (ext === '.js') {
      const content = await readFile(resolvedPath, 'utf-8');
      
      // 检查文件内容，判断是 ESM 还是 CommonJS
      if (content.includes('module.exports') || content.includes('exports.')) {
        // CommonJS 风格
        try {
          console.log(`尝试以 CommonJS 方式加载: ${resolvedPath}`);
          // 使用 require 加载模块
          const moduleFn = require(resolvedPath);
          return moduleFn;
        } catch (err) {
          console.error(`CommonJS 加载失败:`, err);
          throw err;
        }
      } else {
        // 可能是 ESM 风格或其他
        try {
          console.log(`尝试以 ESM 方式加载: ${resolvedPath}`);
          // 使用 import() 动态加载
          const moduleFn = await import(`file://${resolvedPath}`);
          return moduleFn.default || moduleFn;
        } catch (err) {
          console.error(`ESM 加载失败:`, err);
          
          // 最后尝试通过执行上下文动态执行代码（危险但在某些情况下有效）
          console.log(`尝试通过执行上下文加载...`);
          // 创建一个模拟的模块对象
          const mockModule = { exports: {} };
          const mockRequire = (id: string) => require(id);
          const mockExports = mockModule.exports;
          
          // 添加头部和尾部使其成为可执行的函数
          const wrappedCode = `
            (function(module, exports, require) {
              ${content}
              return module.exports;
            })(mockModule, mockExports, mockRequire)
          `;
          
          // 尽量安全地执行代码（不推荐在生产环境中使用）
          try {
            const moduleExports = eval(wrappedCode);
            return moduleExports;
          } catch (evalErr) {
            console.error(`执行上下文加载失败:`, evalErr);
            throw evalErr;
          }
        }
      }
    }
    
    // JSON 文件
    else if (ext === '.json') {
      const content = await readFile(resolvedPath, 'utf-8');
      return JSON.parse(content);
    }
    
    // TypeScript 文件（需要 ts-node 支持）
    else if (ext === '.ts') {
      try {
        // 先查看是否有对应的编译后JS文件
        const jsPath = resolvedPath.replace(/\.ts$/, '.js');
        if (fs.existsSync(jsPath)) {
          console.log(`找到编译后的JS文件: ${jsPath}，尝试加载`);
          return await dynamicImport(jsPath, basePath);
        }

        // 尝试直接导入TypeScript文件（需要配置好tsconfig和ts-node环境）
        console.log(`尝试以 ESM 方式加载 TypeScript 文件: ${resolvedPath}`);
        const moduleFn = await import(`file://${resolvedPath}`);
        return moduleFn.default || moduleFn;
      } catch (tsErr) {
        console.error(`TypeScript 文件加载失败:`, tsErr);
        
        // 尝试读取内容，通过脚本执行器解析
        console.log(`尝试通过脚本执行器处理 TypeScript 内容...`);
        const content = await readFile(resolvedPath, 'utf-8');
        
        // 注意：这里假设有一个上层的脚本执行环境，采用脚本的方式执行
        // 如果没有ts-node环境，这里会失败
        throw new Error(`TypeScript 文件加载失败: ${tsErr.message}\n建议先将 TypeScript 文件编译为 JavaScript`);
      }
    }
    
    // 其他文件类型，尝试直接读取内容
    else {
      const content = await readFile(resolvedPath, 'utf-8');
      return content;
    }
  } catch (error: any) {
    throw new Error(`Failed to import module: ${modulePath}\n${error.message}`);
  }
}

/**
 * 简化版的动态导入，仅处理相对路径和简单的导入场景
 * 用于类型和配置的导入，不涉及执行代码
 */
export async function simpleImport(modulePath: string, basePath: string = process.cwd()): Promise<any> {
  try {
    // 处理相对路径
    let resolvedPath = modulePath;
    if (modulePath.startsWith('.')) {
      resolvedPath = path.resolve(basePath, modulePath);
    }
    
    const module = await import(resolvedPath);
    return module.default || module;
  } catch (error: any) {
    throw new Error(`Failed to import module: ${modulePath}\n${error.message}`);
  }
}
