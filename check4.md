# Mastra Runtimes 项目分析与命令行工具规划

## 1. 项目现状分析

Mastra Runtimes 是一个模块化、声明式的 AI 应用运行时系统，采用了 Kubernetes 风格的资源管理模型。目前项目已实现了基础架构和核心功能：

### 1.1 已实现的核心特性
- **声明式配置**：使用 YAML 定义和管理所有资源（Agent、Tool、Workflow、Network 等）
- **控制器模式**：采用类 Kubernetes 的控制器管理资源生命周期
- **事件驱动架构**：基于事件总线实现组件间松耦合通信
- **资源状态管理**：跟踪和管理所有资源的状态和条件
- **高级 API**：提供 MastraPod API 简化资源加载和交互

### 1.2 当前存在的问题

1. **缺乏统一的命令行接口**：
   - 虽然已有 `CLIRuntimeManager` 类，但尚未暴露为统一的命令行工具
   - 用户必须编写代码来加载和执行资源，缺乏直接的 CLI 交互方式

2. **复杂的运行流程**：
   - 使用者需要先理解内部架构才能有效使用
   - 没有简单的"一键运行"方式执行 YAML 定义的资源

3. **资源间关系管理**：
   - 资源依赖关系需要手动处理
   - 缺少自动化的资源关系解析和验证

4. **监控和调试困难**：
   - 缺乏可视化的运行状态监控
   - 故障排查需要深入代码

5. **与 Kubernetes 概念映射不完全**：
   - 虽然采用了类似概念，但缺少命名空间管理和资源版本控制等特性

## 2. 命令行工具（mastrapod）规划

### 2.1 设计目标

创建一个类似 `kubectl` 的命令行工具 `mastrapod`，使用户能够：

1. 直接从命令行管理和执行 Mastra 资源
2. 简化资源创建、更新和删除操作
3. 提供直观的资源状态查看
4. 支持实时监控执行过程
5. 简化调试和问题排查

### 2.2 命令行结构设计

```
mastrapod [全局选项] <命令> [子命令] [选项] [参数]
```

#### 全局选项
- `--config <文件路径>`: 指定配置文件
- `--context <名称>`: 使用特定上下文
- `--namespace <名称>`: 指定命名空间，默认为 "default"
- `--output <格式>`: 指定输出格式（json, yaml, table），默认为 table
- `--verbose`: 详细输出模式
- `--help`: 显示帮助信息
- `--version`: 显示版本信息

#### 核心命令

1. **资源管理命令**
   ```
   mastrapod apply -f <文件名>       # 应用资源定义
   mastrapod get <资源类型> [名称]    # 获取资源信息
   mastrapod delete <资源类型> <名称> # 删除资源
   mastrapod edit <资源类型> <名称>   # 编辑资源
   mastrapod describe <资源类型> <名称> # 获取资源详情
   ```

2. **执行命令**
   ```
   mastrapod run agent <名称> [--input <输入>]     # 执行智能体
   mastrapod run workflow <名称> [--input <输入>]  # 执行工作流
   mastrapod run network <名称> [--input <输入>]   # 执行网络
   ```

3. **监控命令**
   ```
   mastrapod logs <资源类型> <名称>   # 查看执行日志
   mastrapod watch <资源类型> [名称]  # 实时监控资源状态
   ```

4. **其他命令**
   ```
   mastrapod completion          # 生成自动完成脚本
   mastrapod plugin <子命令>     # 管理插件
   mastrapod config <子命令>     # 管理配置
   ```

### 2.3 资源类型

支持的资源类型及其简写：
- `agents` / `agent` / `ag`
- `tools` / `tool` / `t`
- `workflows` / `workflow` / `wf`
- `networks` / `network` / `net`
- `providers` / `provider` / `prov`
- `customresourcedefinitions` / `crd`

### 2.4 输出格式示例

```
$ mastrapod get agents
NAMESPACE   NAME            MODEL        TOOLS           AGE   STATUS
default     qa-agent        gpt-4        search,calc     2h    Ready
cooking     recipe-agent    gpt-3.5      recipe-finder   5m    Ready

$ mastrapod get workflows
NAMESPACE   NAME              STEPS   STATUS    AGE
default     simple-workflow   3       Ready     1h
research    data-analysis     5       Ready     30m

$ mastrapod describe agent qa-agent
Name:         qa-agent
Namespace:    default
API Version:  mastra.ai/v1
Kind:         Agent
Metadata:
  Creation Timestamp:  2023-05-01T12:30:45Z
Spec:
  Instructions:  你是一个问答助手，可以回答各种问题...
  Model:
    Provider:  openai
    Name:      gpt-4
  Tools:
    search:  search-tool
    calc:    calculator-tool
Status:
  Phase:  Ready
  Last Execution:  2023-05-01T14:25:10Z
  Conditions:
    Type:    Ready
    Status:  True
    Reason:  ResourcesAvailable
```

## 3. 实现方案

### 3.1 主要组件

1. **命令行解析器**
   - 使用 Commander.js 或 Yargs 构建命令行接口
   - 实现命令注册和参数验证机制

2. **资源管理器**
   - 基于现有的 `CLIRuntimeManager` 实现
   - 增强与文件系统的交互
   - 添加资源缓存机制

3. **执行引擎**
   - 封装现有的 `MastraPod` API
   - 增加流式输出支持
   - 实现中断与恢复机制

4. **状态监控器**
   - 实现资源状态的实时监控
   - 提供结构化的日志输出
   - 支持多种输出格式

5. **配置管理器**
   - 管理 CLI 工具配置
   - 支持多上下文和环境切换
   - 集成环境变量管理

### 3.2 扩展现有代码

需要扩展现有的代码，主要涉及：

1. **新增 CLI 入口模块**
   - 创建 `src/cli/index.ts` 作为 CLI 入口点
   - 集成命令注册和解析逻辑

2. **扩展 CLIRuntimeManager**
   - 增强 `src/core/cli-runtime-manager.ts`
   - 添加资源状态查询和格式化输出功能
   - 实现命令执行结果流式传输

3. **资源输出格式化**
   - 创建 `src/cli/formatters` 目录
   - 实现 JSON、YAML、Table 等输出格式

4. **构建配置管理**
   - 创建 `src/cli/config-manager.ts`
   - 实现配置文件读写和合并

5. **文件系统交互增强**
   - 改进资源文件加载和保存机制
   - 支持多文件和目录处理

### 3.3 技术选型

1. **核心库**
   - 命令行解析: Commander.js
   - 表格输出: cli-table3
   - YAML 处理: js-yaml
   - 颜色输出: chalk
   - 进度展示: ora
   - 文件处理: glob, fs-extra

2. **类型定义**
   - 使用 TypeScript 接口定义命令和选项
   - 使用泛型处理不同资源类型

3. **测试策略**
   - 使用 Jest 进行单元测试
   - 使用 Supertest 进行命令行集成测试

### 3.4 实现步骤

#### 阶段 1：基础框架（2-3周）
1. 创建命令行解析框架
2. 实现核心命令（apply, get, run）
3. 基本资源输出格式化
4. 集成已有 CLIRuntimeManager

#### 阶段 2：增强功能（3-4周）
1. 实现完整命令集
2. 添加监控和日志功能
3. 实现多种输出格式
4. 增强错误处理和帮助提示

#### 阶段 3：用户体验优化（2-3周）
1. 改进命令帮助和文档
2. 添加自动补全
3. 优化交互式体验
4. 实现配置管理

#### 阶段 4：测试与完善（2-3周）
1. 编写单元测试和集成测试
2. 用户反馈收集和问题修复
3. 完善文档和示例
4. 准备发布

## 4. 代码示例

### 4.1 CLI 入口（src/cli/index.ts）

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';
import { registerCommands } from './commands';
import { loadConfig } from './config-manager';

// 创建主程序
const program = new Command('mastrapod');

// 设置版本和描述
program
  .version(version)
  .description('命令行工具，用于管理和执行 Mastra 资源')
  .option('-c, --config <path>', '配置文件路径')
  .option('-n, --namespace <namespace>', '命名空间', 'default')
  .option('-o, --output <format>', '输出格式(json|yaml|table)', 'table')
  .option('-v, --verbose', '详细输出')
  .hook('preAction', async (thisCommand) => {
    // 加载配置
    const options = thisCommand.opts();
    await loadConfig(options.config);
  });

// 注册所有命令
registerCommands(program);

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
```

### 4.2 Apply 命令实现（src/cli/commands/apply.ts）

```typescript
import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { load } from 'js-yaml';
import { CLIRuntimeManager } from '../../core/cli-runtime-manager';
import { formatOutput } from '../formatters';

export function registerApplyCommand(program: Command): void {
  program
    .command('apply')
    .description('创建或更新资源')
    .requiredOption('-f, --file <path>', '资源定义文件路径')
    .option('--dry-run', '仅测试，不实际应用', false)
    .action(async (options) => {
      try {
        const runtimeManager = new CLIRuntimeManager();
        await runtimeManager.initialize();
        
        const filePath = options.file;
        const resource = await runtimeManager.parseFile(filePath);
        
        if (options.dryRun) {
          console.log('DRY RUN: 将应用以下资源:');
          console.log(formatOutput(resource, program.opts().output));
          return;
        }
        
        await runtimeManager.loadResource(resource);
        console.log(`${resource.kind} "${resource.metadata.name}" 已成功应用`);
      } catch (error) {
        console.error('应用资源失败:', (error as Error).message);
        process.exit(1);
      }
    });
}
```

### 4.3 Run 命令实现（src/cli/commands/run.ts）

```typescript
import { Command } from 'commander';
import { CLIRuntimeManager } from '../../core/cli-runtime-manager';
import { formatOutput } from '../formatters';

export function registerRunCommands(program: Command): void {
  const runCommand = program
    .command('run')
    .description('执行 Mastra 资源');
  
  // 运行智能体
  runCommand
    .command('agent <name>')
    .description('执行智能体')
    .option('-i, --input <text>', '输入文本')
    .option('-f, --input-file <path>', '从文件读取输入')
    .action(async (name, options) => {
      try {
        const runtimeManager = new CLIRuntimeManager();
        await runtimeManager.initialize();
        
        // 获取输入
        let input = options.input || '';
        if (options.inputFile) {
          input = await readFile(options.inputFile, 'utf-8');
        }
        
        console.log(`正在执行智能体 "${name}"...`);
        const result = await runtimeManager.executeAgent(name, input);
        console.log('\n结果:');
        console.log(result);
      } catch (error) {
        console.error('执行智能体失败:', (error as Error).message);
        process.exit(1);
      }
    });
  
  // 运行工作流
  runCommand
    .command('workflow <name>')
    .description('执行工作流')
    .option('-i, --input <json>', '输入JSON数据')
    .option('-f, --input-file <path>', '从文件读取输入JSON')
    .action(async (name, options) => {
      try {
        const runtimeManager = new CLIRuntimeManager();
        await runtimeManager.initialize();
        
        // 获取输入
        let inputData = {};
        if (options.input) {
          inputData = JSON.parse(options.input);
        } else if (options.inputFile) {
          const inputJson = await readFile(options.inputFile, 'utf-8');
          inputData = JSON.parse(inputJson);
        }
        
        // 获取工作流资源
        const nameParts = name.split('.');
        const namespace = nameParts.length > 1 ? nameParts[0] : 'default';
        const workflowName = nameParts.length > 1 ? nameParts[1] : name;
        
        const resources = await runtimeManager.scanDirectory('.');
        const workflow = resources.find(
          r => r.kind === 'Workflow' && 
              r.metadata.name === workflowName && 
              (r.metadata.namespace || 'default') === namespace
        ) as any;
        
        if (!workflow) {
          throw new Error(`找不到工作流 "${name}"`);
        }
        
        console.log(`正在执行工作流 "${name}"...`);
        
        // 设置事件监听
        runtimeManager.on('step:start', (data) => {
          console.log(`开始执行步骤: ${data.stepId}`);
        });
        
        runtimeManager.on('step:complete', (data) => {
          console.log(`步骤执行完成: ${data.stepId}`);
        });
        
        // 执行工作流
        await runtimeManager.executeWorkflow(workflow);
        console.log('工作流执行完成');
      } catch (error) {
        console.error('执行工作流失败:', (error as Error).message);
        process.exit(1);
      }
    });
}
```

## 5. 下一步行动计划

### 5.1 近期目标（1-2个月）

1. 完成 CLI 框架搭建和核心命令实现
   - 创建 CLI 项目结构
   - 实现基本命令（apply, get, run）
   - 添加基础输出格式化

2. 改进资源解析和执行
   - 增强 CLIRuntimeManager 功能
   - 改进资源依赖解析
   - 添加执行监控

3. 编写基本文档
   - 命令使用指南
   - 资源定义示例
   - 快速入门教程

### 5.2 中期目标（3-4个月）

1. 完善命令集和功能
   - 实现所有计划的命令
   - 添加交互式功能
   - 增强错误处理和提示

2. 测试和用户反馈
   - 编写测试套件
   - 收集初步用户反馈
   - 修复问题和改进体验

3. 持续集成与发布
   - 设置 CI/CD 流程
   - 准备 NPM 包发布
   - 创建安装和更新机制

### 5.3 长期目标（6个月以上）

1. 扩展插件系统
   - 设计插件 API
   - 实现插件加载机制
   - 开发示例插件

2. 增强开发者体验
   - 创建在线文档站点
   - 提供更多示例和教程
   - 开发 VSCode 扩展

3. 构建生态系统
   - 创建资源共享平台
   - 鼓励社区贡献
   - 探索商业应用场景

## 6. 总结

通过实现类似 kubectl 的命令行工具 `mastrapod`，我们将：

1. **简化使用体验**：使用户无需编写代码即可管理和执行 Mastra 资源
2. **提高生产力**：加速开发和调试流程
3. **增强可维护性**：采用统一的资源管理方式
4. **完善生态系统**：为更广泛的应用场景铺平道路

这一方案将利用 Mastra Runtimes 的现有架构，同时显著提升用户体验和系统能力，使其更加符合现代声明式系统的操作模式。 