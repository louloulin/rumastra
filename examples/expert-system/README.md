# 客户支持专家系统示例

这个示例展示了如何使用 kastra 模块创建一个完整的声明式 AI 系统，该系统能够处理客户查询并路由到适当的专业代理进行处理。

## 功能特点

本示例演示了 kastra 的多种核心功能：

1. **声明式配置**: 使用 Kubernetes 风格的 YAML 配置定义整个系统
2. **工具集成**: 通过声明式定义连接到外部工具
3. **多代理协作**: 多个专业代理协同工作处理客户请求
4. **工作流编排**: 预定义的客户入职工作流
5. **智能体网络**: 动态的代理协作和路由
6. **状态管理**: 跨多次调用的会话状态保持

## 系统组件

系统由以下组件组成：

- **工具**: 数据库查询、工单创建、知识库搜索
- **代理**: 
  - 欢迎代理: 处理初始客户互动
  - 技术支持代理: 解决技术问题
  - 账单代理: 处理账单和支付问题
  - 路由代理: 决定将请求路由到哪个专业代理
- **工作流**: 客户入职流程，以结构化方式引导客户
- **网络**: 智能体网络，允许代理之间进行动态协作

## 安装与设置

1. 确保已安装 Node.js 16+ 和 npm/pnpm

2. 安装依赖

```bash
pnpm install
```

3. 创建 `.env` 文件并添加需要的 API 密钥:

```
OPENAI_API_KEY=sk-...your-openai-key...
ANTHROPIC_API_KEY=sk-...your-anthropic-key...
```

## 运行示例

在示例目录中运行:

```bash
node index.js
```

程序会加载配置并提供两种交互模式:

1. **工作流模式**: 按照预定义的工作流处理客户请求
2. **网络模式**: 使用智能体网络动态决定使用哪个代理处理请求

## 工具实现

示例中引用的工具需要实现才能完全运行。示例工具实现可以放在 `tools/` 目录下，比如:

- `tools/database-query.js` - 实现数据库查询工具
- `tools/ticket-creator.js` - 实现工单创建工具
- `tools/knowledge-search.js` - 实现知识库搜索工具

工具实现通常需要导出 `execute` 函数:

```javascript
// tools/database-query.js 示例
export async function execute({ customerId, query }) {
  // 实现数据库查询逻辑
  // ...
  return {
    result: { /* 查询结果 */ }
  };
}
```

## 自定义和扩展

### 添加新代理

在 `config.yaml` 中添加新的代理定义:

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: new-agent
  namespace: support
spec:
  name: "新代理"
  instructions: "新代理的指令..."
  model:
    provider: openai
    name: gpt-4
```

### 扩展工作流

在工作流定义中添加新的步骤:

```yaml
- id: new-step
  name: "新步骤"
  agent: support.new-agent
  input:
    message: "输入消息"
  output:
    result: text
  next: another-step
```

### 添加到网络

在网络定义的 `agents` 列表中添加新代理:

```yaml
agents:
  - name: new-agent
    ref: support.new-agent
```

## 声明式架构优势

这个示例展示了声明式架构的多种优势:

1. **配置与实现分离**: 整个系统的行为通过配置定义，无需修改代码
2. **可视性**: 系统的组件和关系一目了然
3. **可维护性**: 轻松添加、修改或删除组件
4. **跨环境一致性**: 相同的配置可以在不同环境中生成相同的系统行为

## 工作流 vs. 网络

示例同时展示了两种协作模式的差异:

- **工作流**: 预定义的执行路径，适合结构化任务
- **网络**: 动态决策的协作，适合复杂且多变的任务

通过对比这两种模式，您可以了解何时使用哪种模式更为合适。 