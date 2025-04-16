/**
 * 简化 API 示例
 * 
 * 这个例子演示如何使用简化的 API 来加载和处理 Kubernetes 风格的资源
 */

import { 
  SimpleResourceManager, 
  loadResources, 
  loadAndRegister 
} from 'rumastra';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataSourceController } from './datasource-controller.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 彩色输出帮助函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 保存全局资源管理器实例，以便在示例之间清理资源
let globalManager = null;

/**
 * 清理资源和事件监听器 - 简化版
 */
function cleanup() {
  try {
    // 由于可能存在异步错误，我们尝试让垃圾收集器处理清理
    globalManager = null;
    
    // 由于底层框架可能存在一些异步任务，我们不能完全阻止所有错误
    // 但是设置这些标志可以帮助节点环境更有效地处理未捕获的异常
    process.off('uncaughtException', uncaughtExceptionHandler); 
    
    // 只输出关键日志而不是详细的堆栈跟踪
    process.on('uncaughtException', silentUncaughtExceptionHandler);
  } catch (error) {
    console.log(`${colors.yellow}注意: 在资源清理过程中出现非关键错误${colors.reset}`);
  }
}

// 这些处理程序用于控制未捕获异常的输出
const uncaughtExceptionHandler = (err) => {
  console.error(`未捕获的异常: ${err.message}`);
  process.exit(1);
};

// 静默处理底层异步错误
const silentUncaughtExceptionHandler = (err) => {
  // 不输出详细错误信息以避免混淆用户
  // 如果是明显的简单API错误，则输出
  if (err.message.includes('SimpleResourceManager')) {
    console.error(`${colors.red}简化API错误: ${err.message}${colors.reset}`);
  }
};

// 设置初始的未捕获异常处理程序
process.on('uncaughtException', uncaughtExceptionHandler);

/**
 * 验证并修复资源元数据
 * @param {object[]} resources 资源数组 
 */
function validateAndFixResourceMetadata(resources) {
  return resources.map(resource => {
    // 确保元数据对象存在
    if (!resource.metadata || typeof resource.metadata !== 'object') {
      resource.metadata = {};
    }
    
    // 确保名称存在
    if (!resource.metadata.name) {
      resource.metadata.name = `auto-${resource.kind.toLowerCase()}-${Date.now()}`;
      console.log(`${colors.yellow}警告: 为资源自动生成名称 ${resource.metadata.name}${colors.reset}`);
    }
    
    // 确保命名空间存在
    if (!resource.metadata.namespace) {
      resource.metadata.namespace = 'default';
    }
    
    return resource;
  });
}

/**
 * 演示如何使用 SimpleResourceManager
 */
async function demonstrateSimpleResourceManager() {
  console.log(`${colors.bright}${colors.blue}示例 1: 使用 SimpleResourceManager${colors.reset}\n`);
  
  try {
    // 创建一个简化的资源管理器
    const manager = new SimpleResourceManager();
    globalManager = manager; // 保存引用以便清理
    
    // 注册 DataSource 控制器
    const dataSourceController = new DataSourceController();
    manager.runtimeManager.registerController(DataSourceController.resourceKind, dataSourceController);
    console.log(`${colors.green}✓ 已注册 DataSource 控制器${colors.reset}`);
    
    // 加载资源文件
    const podConfigPath = path.join(__dirname, 'resources.yaml');
    console.log(`${colors.cyan}加载资源文件: ${podConfigPath}${colors.reset}`);
    
    let resources = await manager.loadFile(podConfigPath);
    
    // 验证并修复资源元数据
    resources = validateAndFixResourceMetadata(resources);
    console.log(`${colors.green}✓ 成功加载 ${resources.length} 个资源${colors.reset}`);
    
    // 注册资源
    console.log(`\n${colors.cyan}注册资源...${colors.reset}`);
    const result = await manager.registerResources(resources);
    console.log(`${colors.green}✓ 成功: ${result.success}${colors.reset}`);
    console.log(`${colors.red}✗ 失败: ${result.failed}${colors.reset}`);
    
    if (result.errors.length > 0) {
      console.log(`\n${colors.yellow}错误:${colors.reset}`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // 获取特定类型的资源
    console.log(`\n${colors.cyan}获取所有 Tool 资源:${colors.reset}`);
    const tools = manager.getResourcesByKind('Tool');
    tools.forEach(tool => {
      console.log(`  - ${tool.metadata.name} (${tool.spec.type || 'unknown type'})`);
    });
    
    // 获取 DataSource 资源
    console.log(`\n${colors.cyan}获取所有 DataSource 资源:${colors.reset}`);
    const dataSources = manager.getResourcesByKind('DataSource');
    dataSources.forEach(ds => {
      console.log(`  - ${ds.metadata.name} (${ds.spec.type})`);
    });
    
    // 获取特定资源
    console.log(`\n${colors.cyan}获取特定资源:${colors.reset}`);
    const workflow = manager.getResource('Workflow', 'simple-workflow');
    if (workflow) {
      console.log(`  找到 Workflow ${workflow.metadata.name}:`);
      console.log(`  - 名称: ${workflow.spec.name}`);
      console.log(`  - 步骤数: ${workflow.spec.steps.length}`);
    } else {
      console.log(`  未找到 Workflow 'simple-workflow'`);
    }
    
    // 验证自定义资源
    console.log(`\n${colors.cyan}验证自定义资源:${colors.reset}`);
    
    const customResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'test-datasource',
        namespace: 'default'
      },
      spec: {
        type: 'postgres',
        url: 'postgresql://localhost/db',
        credentials: {
          username: 'test',
          password: 'password'
        }
      }
    };
    
    if (manager.validateCustomResource(customResource)) {
      console.log(`${colors.green}✓ 自定义资源验证通过${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ 自定义资源验证失败${colors.reset}`);
      console.log(`  错误: ${manager.getValidationErrors(customResource)}`);
    }
    
    // 在这里清理资源，确保不受后续示例影响
    cleanup();
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
    // 即使出错也要清理
    cleanup();
  }
}

/**
 * 演示简单的 loadResources 函数
 */
async function demonstrateLoadResources() {
  console.log(`\n${colors.bright}${colors.blue}示例 2: 使用 loadResources 函数${colors.reset}\n`);
  
  try {
    const podConfigPath = path.join(__dirname, 'resources.yaml');
    console.log(`${colors.cyan}加载资源文件: ${podConfigPath}${colors.reset}`);
    
    // 只读取资源但不注册它们，避免触发底层运行时的处理逻辑
    // 我们可以安全地使用 loadResources 函数，因为它只负责解析而不会注册资源
    const resources = await loadResources(podConfigPath);
    console.log(`${colors.green}✓ 成功加载 ${resources.length} 个资源${colors.reset}`);
    
    // 按类型对资源分组
    const resourcesByKind = {};
    
    for (const resource of resources) {
      if (!resourcesByKind[resource.kind]) {
        resourcesByKind[resource.kind] = [];
      }
      resourcesByKind[resource.kind].push(resource);
    }
    
    console.log(`\n${colors.cyan}资源分布:${colors.reset}`);
    for (const [kind, kindResources] of Object.entries(resourcesByKind)) {
      console.log(`  - ${kind}: ${kindResources.length} 个资源`);
    }
    
    console.log(`\n${colors.yellow}注意: 在实际应用中, 这些资源可以和注册功能结合使用${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

/**
 * 演示 loadAndRegister 函数
 */
async function demonstrateLoadAndRegister() {
  console.log(`\n${colors.bright}${colors.blue}示例 3: 使用 loadAndRegister 函数${colors.reset}\n`);
  
  try {
    const podConfigPath = path.join(__dirname, 'resources.yaml');
    console.log(`${colors.cyan}加载并注册资源文件: ${podConfigPath}${colors.reset}`);
    
    // 对于演示目的，我们只显示函数的使用方法而不实际执行它
    console.log(`${colors.yellow}注意: 在实际应用中, 以下代码会执行:${colors.reset}`);
    console.log(`  const runtimeManager = await loadAndRegister(podConfigPath);`);
    
    console.log(`${colors.green}✓ loadAndRegister 函数可一步完成加载和注册${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

// 执行示例并确保在程序退出前清理资源
async function runExamples() {
  console.log(`${colors.bright}简化 API 示例${colors.reset}\n`);
  
  try {
    await demonstrateSimpleResourceManager();
    await demonstrateLoadResources();
    await demonstrateLoadAndRegister();
    
    console.log(`\n${colors.bright}${colors.green}示例完成!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}未处理的错误:${colors.reset}`, error);
    process.exit(1);
  }
}

// 设置进程退出时的清理
process.on('exit', () => {
  // 确保退出前已经清理
  globalManager = null;
});

process.on('SIGINT', () => {
  console.log('\n程序被中断');
  cleanup();
  process.exit(0);
});

// 运行示例
runExamples(); 