# Quick Pod 示例

这是一个简单的 MastraPod 示例，展示了如何使用 MastraPod API 创建一个多功能的问答助手。

## 功能特点

- 简单的配置文件结构
- 多工具支持：
  - 搜索工具：用于查找信息
  - 天气工具：用于查询城市天气
  - 计算器：用于计算数学表达式
- 交互式问答界面
- 直接使用 MastraPod API

## 快速开始

1. 安装依赖：
```bash
pnpm install
```

2. 设置环境变量：
```bash
export OPENAI_API_KEY=你的OpenAI API密钥
```

3. 运行示例：
```bash
pnpm start
```

4. 开始交互式问答：
```
> 北京的天气怎么样？
> 计算 10 + 20 * 3 的结果
> 什么是量子计算？
```

## 代码结构

- `config.yaml`: MastraPod 配置文件，定义了工具和代理
- `mastrapod.yaml`: 另一个示例配置文件，展示了更多功能
- `index.js`: 主运行脚本，展示如何使用 MastraPod API
- `package.json`: 项目配置文件

## 配置说明

配置文件包含四个主要部分：

1. 搜索工具：用于模拟信息搜索
2. 天气工具：用于模拟天气查询
3. 计算器工具：用于计算数学表达式
4. 问答助手：一个基于 GPT-4 的代理，可以根据问题类型选择合适的工具

## API 使用

### 加载 MastraPod

```javascript
// 方法1：使用 loadFile 加载
import { loadFile } from 'rumastra';
const pod = await loadFile('config.yaml', { env: process.env });

// 方法2：直接使用 MastraPod 类
import { MastraPod } from 'rumastra';
const pod = new MastraPod();
await pod.addFile('config.yaml');
```

### 使用代理

```javascript
// 检查代理是否存在
if (pod.hasAgent('qa-agent')) {
  // 运行代理
  const response = await pod.runAgent('qa-agent', '你的问题');
  console.log(response.result.content);
}
```

### 使用工具

```javascript
// 直接调用工具
const response = await pod.callTool('calculator-tool', {
  expression: '3 * (4 + 5)'
});
console.log(response.result);
```

### 使用工作流

```javascript
// 运行工作流
const response = await pod.runWorkflow('math-workflow', {
  problem: 'What is 7 * 8?'
});
console.log(response.result);
```

## MastraPod API 核心功能

### 资源管理
```javascript
// 获取所有工具
const tools = pod.getTools();

// 获取所有代理
const agents = pod.getAgents();

// 获取所有工作流
const workflows = pod.getWorkflows();

// 检查资源是否存在
const hasAgent = pod.hasAgent('agent-name');
const hasTool = pod.hasTool('tool-name');
const hasWorkflow = pod.hasWorkflow('workflow-name');
```

## 扩展建议

1. 添加更多工具：例如翻译、新闻聚合、数据分析等
2. 添加内存支持：使用 MastraPod 的内存 API 实现对话历史
3. 实现更复杂的工作流：创建多步骤工作流来处理复杂任务
4. 添加 UI 界面：构建一个简单的 Web 界面来与代理交互
5. 增加错误处理：改进错误处理和重试机制 