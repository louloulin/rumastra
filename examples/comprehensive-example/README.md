# Mastra Runtimes 综合示例

这是一个使用 Mastra Runtimes 的综合示例，展示如何通过声明式 DSL 配置和运行 AI 工具、代理、工作流和智能体网络。

## 示例特点

- **声明式配置**：通过 YAML 配置文件定义所有资源
- **多种资源类型**：展示工具、代理、工作流和网络的定义和使用
- **模板变量**：演示工作流中的模板插值功能
- **多模型支持**：配置使用 OpenAI 和 Anthropic 模型
- **工具集成**：包含网络搜索、计算器、天气查询和新闻获取等工具
- **复杂工作流**：演示多步骤、数据传递的工作流设计
- **智能体网络**：展示智能体网络的路由和协作功能

## 示例内容

本示例包含以下核心组件：

### 1. 工具资源

- **Web Search Tool**：模拟网络搜索功能
- **Calculator Tool**：执行基本算术运算
- **Weather Tool**：获取指定位置的天气信息
- **News Tool**：获取特定主题的最新新闻

### 2. 代理资源

- **Research Agent**：研究助手，帮助查找和整理信息
- **Math Agent**：数学助手，解决数学问题
- **Travel Agent**：旅行助手，提供旅行建议
- **Summary Agent**：摘要助手，整合和总结信息

### 3. 工作流资源

- **Research Workflow**：三步工作流，收集和总结特定主题的信息
- **Travel Planning Workflow**：三步工作流，提供旅行规划和建议

### 4. 网络资源

- **Personal Assistant Network**：集成多个专业代理的个人助理网络

## 快速开始

### 安装依赖

确保你已经在项目根目录安装了所有必要的依赖：

```bash
# 安装依赖
pnpm install
```

### 运行示例

```bash
# 设置环境变量（可选，示例会使用模拟密钥）
export OPENAI_API_KEY=your-openai-key
export ANTHROPIC_API_KEY=your-anthropic-key

# 运行示例
node index.js
```

### 示例输出

运行示例后，你将看到：

1. 加载和解析 MastraPod 配置
2. 执行智能体网络请求（搜索量子计算）
3. 执行研究工作流（AI在医疗领域的应用）
4. 执行旅行规划工作流（杭州旅行计划）

每个执行都会显示详细的步骤输出和最终结果。

## 代码解析

### 配置文件结构

`config.yaml` 文件使用 Kubernetes 风格的声明式 API 定义资源：

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: comprehensive-example
  namespace: default

# 全局提供者配置
providers:
  openai:
    apiKey: ${env.OPENAI_API_KEY}
  
# 资源定义
resources:
  # 工具、代理、工作流和网络定义...
```

### 资源定义

每种资源都有统一的结构，包括 apiVersion、kind、metadata 和 spec：

```yaml
- apiVersion: mastra/v1
  kind: Tool
  metadata:
    name: tool-name
    namespace: default
  spec:
    # 工具特定配置...
```

### 工作流步骤

工作流步骤定义了执行顺序和数据流：

```yaml
steps:
  - id: step-id
    name: "Step Name"
    agent: agent-name
    input:
      message: "使用模板变量: {{ workflow.input.variable }}"
    next: next-step-id
```

### 模板变量

支持在工作流中引用变量：

- `{{ workflow.input.variable }}` - 引用工作流输入
- `{{ step.step-id.result }}` - 引用步骤结果

## 自定义示例

### 添加新工具

1. 在 `config.yaml` 中添加新的 Tool 资源
2. 实现工具的 execute 函数
3. 在适当的代理中引用新工具

### 添加新代理

1. 在 `config.yaml` 中添加新的 Agent 资源
2. 配置代理的提示词（instructions）和模型
3. 引用所需的工具

### 修改工作流

1. 在 `config.yaml` 中编辑或添加 Workflow 资源
2. 修改或添加工作流步骤
3. 确保步骤之间的连接正确（next 属性）

## 进阶特性

### 环境变量替换

配置中的 `${env.VARIABLE_NAME}` 将被替换为对应的环境变量值。

### 条件执行

通过在工作流步骤输出中返回 next 字段，可以动态决定下一步：

```javascript
return { result: 'some-result', next: condition ? 'step-a' : 'step-b' };
```

### 错误处理

运行时框架包含全面的错误处理机制，确保工作流执行的稳定性。

## 最佳实践

1. **模块化设计**：将复杂功能拆分为多个工具和代理
2. **明确命名**：为资源使用描述性的名称
3. **添加详细描述**：为每个资源添加清晰的描述
4. **适当分组**：使用命名空间组织相关资源
5. **资源复用**：在多个工作流中复用代理和工具

## 常见问题

**Q: 为什么工具执行失败？**  
A: 检查工具函数是否有语法错误，确保参数类型正确。

**Q: 如何调试工作流？**  
A: 在初始化 MastraRuntimeWrapper 时设置 `debug: true` 开启详细日志。

**Q: 如何使用真实的API替代模拟实现？**  
A: 修改工具实现，添加实际的API调用代码替代模拟数据。

## 更多资源

- [Mastra Runtimes 文档](https://github.com/your-org/mastra/docs)
- [声明式 API 参考](https://github.com/your-org/mastra/api-reference)
- [示例库](https://github.com/your-org/mastra/examples) 