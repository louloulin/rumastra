// toolLoader.js - 工具加载器，用于加载 JS 格式的工具模块

const fs = require('fs');
const path = require('path');

/**
 * 加载工具模块
 * @param {string} modulePath 模块路径
 * @param {string} basePath 基础路径
 * @returns {Promise<Object>} 工具模块
 */
async function loadTool(modulePath, basePath = process.cwd()) {
  try {
    // 解析模块绝对路径
    let resolvedPath = modulePath;
    if (modulePath.startsWith('.')) {
      resolvedPath = path.resolve(basePath, modulePath);
    }

    console.log(`[ToolLoader] 加载工具: ${resolvedPath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Module not found: ${resolvedPath}`);
    }
    
    // 读取文件内容
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    
    // 创建并填充虚拟模块
    const mockModule = { exports: {} };
    
    // 创建可信任的环境
    const sandbox = {
      module: mockModule,
      exports: mockModule.exports,
      require: require,
      console: console,
      process: process,
      __dirname: path.dirname(resolvedPath),
      __filename: resolvedPath
    };
    
    // 使用 new Function 执行代码，比 eval 更安全
    const moduleFunction = new Function(
      'module', 'exports', 'require', 'console', 'process', '__dirname', '__filename',
      content
    );
    
    // 执行模块
    moduleFunction(
      sandbox.module, 
      sandbox.exports, 
      sandbox.require, 
      sandbox.console, 
      sandbox.process, 
      sandbox.__dirname, 
      sandbox.__filename
    );
    
    // 返回模块导出
    return mockModule.exports;
  } catch (error) {
    console.error(`[ToolLoader] 加载工具失败:`, error);
    throw new Error(`Failed to load tool module: ${modulePath}\n${error.message}`);
  }
}

// 导出函数
module.exports = {
  loadTool
}; 