# MastraPod CLI 示例

这是一个演示如何使用类似 kubectl 的命令行方式来管理和执行 Mastra 资源的示例项目。

## 概述

MastraPod CLI 是一个命令行工具，允许用户：

1. 创建和管理 Mastra 资源（Agents、Tools、Workflows、Networks）
2. 查看资源信息和状态
3. 执行智能体、工作流和网络
4. 调用工具函数
5. 查看执行历史和日志
6. 管理资源配置和上下文

本项目实现了与 MastraPod 运行时的集成，不仅能模拟资源执行，还能实际加载资源并执行。

## 安装

```bash
# 克隆仓库后进入项目目录
cd examples/mastrapod-cli

# 安装依赖
npm install

# 使脚本可执行
chmod +x mastrapod.js
```

## 使用方法

### 全局选项

- `-n, --namespace <namespace>`: 指定命名空间，默认为 "default"
- `-o, --output <format>`: 指定输出格式（json, yaml, table），默认为 table
- `-v, --verbose`: 详细输出模式
- `--help`: 显示帮助信息
- `--version`: 显示版本信息

### 基本命令

**应用资源定义**:
```bash
./mastrapod.js apply -f example-agent.yaml
./mastrapod.js apply -f example-tool.yaml
```

**获取资源列表**:
```bash
./mastrapod.js get agents
./mastrapod.js get tools
./mastrapod.js get workflows
./mastrapod.js get networks
```

**查看特定资源详情**:
```bash
./mastrapod.js describe agent example-agent
./mastrapod.js describe tool example-tool
```

**执行资源**:
```bash
./mastrapod.js run agent example-agent -i "什么是人工智能？"
./mastrapod.js run workflow example-workflow -p '{"query":"人工智能的应用场景","context":"教育领域"}'
```

**调用工具函数**:
```bash
./mastrapod.js tool example-tool getWeather -p '{"location":"北京"}'
./mastrapod.js tool example-tool calculate -p '{"expression":"(5+3)*2"}'
./mastrapod.js tool example-tool random -p '{"min":1,"max":100,"count":5}'
```

**查看执行历史和日志**:
```bash
./mastrapod.js history --limit 5
./mastrapod.js logs <execution-id>
```

### 使用快捷命令

项目中定义了一些 npm scripts 作为快捷方式：

```bash
# 应用示例资源
npm run apply-agent
npm run apply-workflow
npm run apply-network
npm run apply-tool

# 获取资源列表
npm run get-agents
npm run get-workflows
npm run get-networks
npm run get-tools

# 查看资源详情
npm run describe-agent
npm run describe-tool

# 运行资源
npm run run-agent
npm run run-workflow

# 调用工具函数
npm run run-tool         # 获取天气信息
npm run calc             # 计算数学表达式
npm run random           # 生成随机数

# 查看执行历史
npm run history
```

## 运行时集成

本项目包含一个简化的 MastraPod 运行时实现，位于 `mastrapod-runtime.js`，它提供了以下功能：

1. **资源管理**：
   - 加载和应用资源定义
   - 资源持久化到本地文件系统（`.mastrapod/resources/` 目录）
   - 按命名空间组织资源

2. **执行管理**：
   - 模拟执行资源（Agent、Workflow、Network）
   - 记录执行历史
   - 提供执行日志查询

3. **工具调用**：
   - 调用工具函数
   - 处理函数参数和结果

在实际的 MastraPod 实现中，运行时将连接到 Mastra API 以处理实际的资源执行。

## 示例资源文件

项目包含四个示例资源定义文件：

- `example-agent.yaml`: 一个示例智能体定义
- `example-workflow.yaml`: 一个示例工作流定义
- `example-network.yaml`: 一个示例专家网络定义
- `example-tool.yaml`: 一个示例工具定义，包含多个函数实现

这些文件展示了 Mastra DSL 的基本结构和用法。

## 本地存储

CLI 工具使用本地文件系统来存储资源和状态：

- `.mastrapod/resources/`: 存储资源定义文件
- `.mastrapod/logs/`: 存储执行日志（目前尚未实现日志文件写入）

## 与实际实现的区别

此示例是一个简化的演示，实际的 MastraPod CLI 实现将包括：

1. 与实际 MastraPod API 的完整集成
2. 实际 LLM 和工具的执行支持
3. 更加健壮的错误处理和日志记录
4. 完整的用户认证和授权
5. 高级监控和调试功能

## 下一步

查看 `check4.md` 文件了解完整的 MastraPod CLI 实现计划和路线图。 