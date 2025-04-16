/**
 * 工具资源专用示例
 * 
 * 这个例子演示如何使用简化的 API 加载和使用工具资源
 */

import { SimpleResourceManager } from 'rumastra';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * 工具资源示例
 */
async function demonstrateToolResources() {
  console.log(`${colors.bright}${colors.blue}工具资源示例${colors.reset}\n`);
  
  try {
    // 创建一个简化的资源管理器
    const manager = new SimpleResourceManager();
    
    // 加载资源文件
    const podConfigPath = path.join(__dirname, 'resources.yaml');
    console.log(`${colors.cyan}加载资源文件: ${podConfigPath}${colors.reset}`);
    
    const resources = await manager.loadFile(podConfigPath);
    console.log(`${colors.green}✓ 成功加载资源${colors.reset}`);
    
    // 筛选出工具资源
    const toolResources = resources.filter(resource => resource.kind === 'Tool');
    console.log(`${colors.green}✓ 找到 ${toolResources.length} 个工具资源${colors.reset}`);
    
    // 注册工具资源
    console.log(`\n${colors.cyan}注册工具资源...${colors.reset}`);
    const result = await manager.registerResources(toolResources);
    console.log(`${colors.green}✓ 成功: ${result.success}${colors.reset}`);
    console.log(`${colors.red}✗ 失败: ${result.failed}${colors.reset}`);
    
    if (result.errors.length > 0) {
      console.log(`\n${colors.yellow}错误:${colors.reset}`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // 获取工具资源
    const tools = manager.getResourcesByKind('Tool');
    
    // 展示工具资源详细信息
    if (tools.length > 0) {
      console.log(`\n${colors.cyan}工具资源详情:${colors.reset}`);
      
      tools.forEach(tool => {
        console.log(`\n  ${colors.bright}${tool.metadata.name}${colors.reset}`);
        console.log(`  ${colors.yellow}类型:${colors.reset} ${tool.spec.type}`);
        console.log(`  ${colors.yellow}描述:${colors.reset} ${tool.spec.description}`);
        console.log(`  ${colors.yellow}执行路径:${colors.reset} ${tool.spec.execute}`);
        
        if (tool.spec.endpoint) {
          console.log(`  ${colors.yellow}端点:${colors.reset} ${tool.spec.endpoint}`);
        }
        
        if (tool.spec.auth) {
          console.log(`  ${colors.yellow}认证类型:${colors.reset} ${tool.spec.auth.type}`);
        }
      });
      
      // 模拟调用工具
      console.log(`\n${colors.cyan}模拟工具调用:${colors.reset}`);
      
      // 天气工具
      console.log(`\n  ${colors.bright}调用 weather-tool${colors.reset}`);
      try {
        // 动态导入模块
        const weatherToolPath = path.join(__dirname, 'tools', 'weather.js');
        const weatherToolModule = await import(weatherToolPath);
        const weatherTool = weatherToolModule.default;
        
        // 调用工具
        const weatherResult = await weatherTool({ location: 'Tokyo' });
        console.log(`  ${colors.green}✓ 响应:${colors.reset}`);
        console.log(`    温度: ${weatherResult.temperature}°C`);
        console.log(`    天气状况: ${weatherResult.condition}`);
        console.log(`    湿度: ${weatherResult.humidity}%`);
        console.log(`    风速: ${weatherResult.wind}`);
      } catch (error) {
        console.error(`  ${colors.red}✗ 调用失败: ${error.message}${colors.reset}`);
      }
      
      // 数据库工具
      console.log(`\n  ${colors.bright}调用 database-tool${colors.reset}`);
      try {
        // 动态导入模块
        const dbToolPath = path.join(__dirname, 'tools', 'database.js');
        const dbToolModule = await import(dbToolPath);
        const dbTool = dbToolModule.default;
        
        // 调用工具
        const dbResult = await dbTool({ 
          operation: 'select', 
          table: 'users',
          filters: { role: 'admin' }
        });
        
        console.log(`  ${colors.green}✓ 响应:${colors.reset}`);
        console.log(`    查询到 ${dbResult.count} 条记录`);
        dbResult.data.forEach(user => {
          console.log(`    - ${user.name} (${user.email})`);
        });
      } catch (error) {
        console.error(`  ${colors.red}✗ 调用失败: ${error.message}${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.bright}${colors.green}示例完成!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

// 运行示例
demonstrateToolResources().catch(error => {
  console.error(`未处理的错误:`, error);
  process.exit(1);
}); 