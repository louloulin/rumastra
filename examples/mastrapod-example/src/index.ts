/**
 * MastraPod简化示例
 * 
 * 本示例展示了MastraPod的核心概念：工具、代理和工作流，
 * 但不依赖于复杂的配置和声明式API。
 * 
 * 这些概念的实现方式如下：
 * 1. 工具(Tool) - 简单的JavaScript函数，接收参数并返回结果
 * 2. 代理(Agent) - 包含工具集合的对象，可以调用工具并处理结果
 * 3. 工作流(Workflow) - 多个步骤的序列，每个步骤可以调用代理或工具
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 从rumastra模块导入API
import * as runtime from 'rumastra';
// 使用类型断言获取MastraPod类
const { MastraPod } = runtime as any;

// 获取当前文件目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 工具定义：问候工具
 * 一个简单的工具函数，接收名称参数并返回问候语
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.name - 要问候的人的名称
 * @returns {Object} - 包含问候语的结果对象
 */
function greetingTool(params: any) {
  // 提取参数，设置默认值
  const name = params.name || 'World';
  // 返回执行结果
  return { greeting: `Hello, ${name}!` };
}

/**
 * 工具定义：日期时间工具
 * 返回当前日期和时间信息
 * 
 * @returns {Object} - 包含日期和时间信息的对象
 */
function dateTimeTool() {
  const now = new Date();
  return { 
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    timestamp: now.toISOString()
  };
}

/**
 * 主函数：演示MastraPod核心概念
 */
async function main() {
  try {
    console.log("===== MastraPod API 简化示例 =====");
    console.log("本示例演示MastraPod的核心概念：工具、代理和工作流");
    
    // 1. 直接调用工具
    // ------------------------------------------
    console.log("\n===== 1. 直接调用工具 =====");
    console.log("工具是执行特定功能的函数");
    
    const greetingResult = greetingTool({ name: "Alice" });
    console.log("问候工具结果:", greetingResult);
    
    const dateTimeResult = dateTimeTool();
    console.log("日期时间工具结果:", dateTimeResult);
    
    // 2. 代理及其工具调用
    // ------------------------------------------
    console.log("\n===== 2. 代理及其工具调用 =====");
    console.log("代理可以访问多个工具，并根据指令使用它们");
    
    // 定义一个代理
    const agent = {
      name: "助手代理",
      instructions: "提供问候和时间信息",
      tools: {
        greeting: greetingTool,
        dateTime: dateTimeTool
      }
    };
    
    // 模拟代理执行过程
    console.log(`代理 "${agent.name}" 正在处理请求...`);
    console.log("代理指令:", agent.instructions);
    
    // 代理调用工具
    const toolResult1 = agent.tools.greeting({ name: "Bob" });
    const toolResult2 = agent.tools.dateTime();
    
    // 代理整合工具结果
    const agentResponse = `${toolResult1.greeting} 现在的时间是 ${toolResult2.time}。`;
    console.log("代理响应:", agentResponse);
    
    // 3. 工作流执行
    // ------------------------------------------
    console.log("\n===== 3. 工作流执行 =====");
    console.log("工作流定义了多个相关步骤的执行顺序");
    
    // 定义一个工作流
    const workflow = {
      name: "问候工作流",
      description: "生成自定义问候信息的工作流",
      steps: [
        {
          id: "generate-greeting",
          name: "生成基本问候",
          execute: async (input: any) => {
            console.log("执行步骤: 生成基本问候");
            return { greeting: greetingTool({ name: input.name }).greeting };
          }
        },
        {
          id: "get-datetime",
          name: "获取时间信息",
          execute: async () => {
            console.log("执行步骤: 获取时间信息");
            return dateTimeTool();
          }
        },
        {
          id: "format-result",
          name: "格式化最终结果",
          execute: async (input: any, context: any) => {
            console.log("执行步骤: 格式化最终结果");
            const greeting = context["generate-greeting"].greeting;
            const datetime = context["get-datetime"];
            
            return { 
              message: `${greeting} 今天是 ${datetime.date}，现在是 ${datetime.time}。希望你度过美好的一天！`,
              timestamp: datetime.timestamp
            };
          }
        }
      ]
    };
    
    // 执行工作流
    console.log(`执行工作流 "${workflow.name}"...`);
    console.log("工作流描述:", workflow.description);
    console.log("工作流有", workflow.steps.length, "个步骤");
    
    // 设置工作流输入
    const workflowInput = { name: "Charlie" };
    console.log("工作流输入:", workflowInput);
    
    // 创建工作流上下文来存储步骤结果
    const context: Record<string, any> = {};
    
    // 顺序执行每个步骤
    for (const step of workflow.steps) {
      console.log(`\n执行步骤: ${step.name} (${step.id})`);
      
      // 执行步骤，传入输入和当前上下文
      const result = await step.execute(workflowInput, context);
      
      // 将结果存储在上下文中，以便后续步骤访问
      context[step.id] = result;
      console.log(`步骤 ${step.id} 结果:`, result);
    }
    
    // 显示最终结果
    console.log("\n工作流执行完成!");
    console.log("最终结果:", context["format-result"].message);
    
    // 4. 声明式配置加载示例
    // ------------------------------------------
    console.log("\n===== 4. 声明式配置加载 =====");
    console.log("演示从YAML文件加载MastraPod配置");
    
    // 读取配置文件
    const configPath = path.join(__dirname, 'config.yaml');
    console.log(`读取配置文件: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      console.error(`错误: 配置文件不存在: ${configPath}`);
    } else {
      try {
        console.log("加载YAML配置...");
        const yamlContent = fs.readFileSync(configPath, 'utf8');
        
        console.log(`配置文件大小: ${yamlContent.length} 字节`);
        console.log(`配置前50个字符: ${yamlContent.substring(0, 50)}...`);
        
        // 实例化MastraPod
        console.log("创建MastraPod实例...");
        const pod = new MastraPod({
          debug: true,
          namespace: 'default'
        });
        
        // 监听资源加载事件
        pod.on('resource:added', (data: any) => {
          if (!data || !data.resource) {
            console.log("警告: 收到无效的资源添加事件");
            return;
          }
          
          const resourceType = data.resource.kind || 'Unknown';
          const resourceName = data.resource.metadata?.name || 'unknown';
          const resourceNamespace = data.resource.metadata?.namespace || 'default';
          
          console.log(`资源已加载: ${resourceType}/${resourceNamespace}.${resourceName}`);
        });
        
        // 监听错误事件
        pod.on('error', (error: any) => {
          console.error('MastraPod错误:', error.message || String(error));
        });
        
        // 分析YAML内容
        const yaml = await import('js-yaml');
        try {
          // 使用loadAll处理多文档YAML
          const documents = yaml.loadAll(yamlContent) as any[];
          
          console.log(`YAML解析成功，发现 ${documents.length} 个文档`);
          // 只处理第一个文档（工具资源）
          if (documents.length > 0) {
            const config = documents[0];
            
            console.log("正在处理第一个文档:");
            console.log(`- apiVersion: ${config.apiVersion}`);
            console.log(`- kind: ${config.kind}`);
            console.log(`- metadata.name: ${config.metadata?.name || '未设置'}`);
            
            // 只加载第一个文档（工具资源）
            console.log("将工具资源添加到MastraPod...");
            await pod.addContent(yaml.dump(config));
            console.log("工具资源加载成功!");
            
            // 获取加载的资源
            const tools = pod.getTools() || [];
            console.log(`已加载 ${tools.length} 个工具`);
            
            if (tools.length > 0) {
              console.log("工具列表:");
              tools.forEach((tool: any, index: number) => {
                console.log(`${index + 1}. ${tool.metadata?.name || 'unnamed'} (${tool.spec?.type || 'unknown type'})`);
                console.log(`   描述: ${tool.spec?.description || '无描述'}`);
              });
              
              // 尝试调用工具
              const toolName = 'greeter-tool';
              console.log(`\n尝试调用工具: ${toolName}`);
              
              try {
                const result = await pod.callTool(toolName, { name: 'Emma' });
                console.log("调用成功!");
                console.log("调用结果:", result);
              } catch (error) {
                console.error("工具调用失败:", error instanceof Error ? error.message : String(error));
              }
            } else {
              console.log("未加载任何工具");
            }
          } else {
            console.log("未找到有效的YAML文档");
          }
        } catch (err) {
          console.error("加载或处理配置时发生错误:", err instanceof Error ? err.message : String(err));
          if (err instanceof Error && err.stack) {
            console.error("错误堆栈:", err.stack.split('\n').slice(0, 3).join('\n'));
          }
        }
      } catch (error) {
        console.error("读取或解析配置文件时出错:", error instanceof Error ? error.message : String(error));
      }
    }
    
    // 总结部分
    console.log("\n===== 总结 =====");
    console.log("本示例展示了MastraPod的两种使用方式:");
    console.log("1. 代码实现 - 通过JavaScript/TypeScript代码直接实现工具、代理和工作流");
    console.log("2. 声明式配置 - 通过YAML配置文件定义资源，并用MastraPod API加载执行");
    
    console.log("\n声明式方式更适合复杂的AI应用，因为它可以:");
    console.log("- 将配置与代码分离，提高可维护性");
    console.log("- 支持动态加载和更新，无需重新编译代码");
    console.log("- 提供统一的资源管理方式，简化应用结构");
    console.log("- 实现更灵活的组件编排，便于复用和共享");
  
  } catch (error) {
    console.error("执行过程中发生错误:", error instanceof Error ? error.message : String(error));
  }
}

// 执行主函数
main(); 