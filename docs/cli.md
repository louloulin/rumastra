# Mastra Runtimes CLI

Mastra Runtimes CLI是一个命令行工具，用于管理和执行基于DSL（领域特定语言）定义的Mastra资源。它提供了一种简便的方式来应用资源配置、执行工作流和网络，以及查询资源状态。

## 安装

CLI工具随`kastra`包一起安装。您可以通过以下方式全局安装：

```bash
npm install -g kastra
# 或者
pnpm add -g kastra
# 或者
yarn global add kastra
```

安装后，您可以通过`mastra`命令访问CLI。

## 基本用法

```bash
# 查看帮助信息
mastra --help

# 查看版本
mastra --version
```

## 全局配置

您可以通过`--config`选项指定全局配置文件：

```bash
mastra --config ./mastra-config.json apply ./resources/
```

配置文件格式示例：

```json
{
  "providers": {
    "openai": {
      "apiKey": "your-api-key"
    }
  },
  "memory": {
    "type": "postgres",
    "config": {
      "connectionString": "postgres://user:password@localhost:5432/mastra"
    }
  },
  "logging": {
    "level": "info"
  }
}
```

## 应用资源

`apply`命令用于应用资源定义，可以是单个文件、目录或MastraPod配置：

```bash
# 应用单个资源文件
mastra apply ./resources/agent.yaml

# 应用目录中的所有资源
mastra apply ./resources/

# 递归应用目录及其子目录中的所有资源
mastra apply --recursive ./resources/

# 应用MastraPod配置
mastra apply ./pod.yaml
```

## 执行资源

`run`命令用于执行代理、工作流或网络：

```bash
# 执行代理
mastra run agent customer-support --input "我想退货"

# 从文件读取输入并执行代理
mastra run agent customer-support --file ./input.txt

# 将代理输出保存到文件
mastra run agent customer-support --input "我想退货" --output ./response.txt

# 执行工作流
mastra run workflow order-processing --input "处理订单#12345"

# 执行网络
mastra run network customer-service --input "我需要技术支持"
```

## 查询资源

`get`命令用于查询资源状态：

```bash
# 查询所有代理
mastra get agent

# 查询特定代理
mastra get agent customer-support

# 指定命名空间
mastra get agent --namespace production

# 查询其他资源类型
mastra get workflow
mastra get network
mastra get tool
```

## 资源定义示例

### 代理资源

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: customer-support
  namespace: default
spec:
  instructions: "你是一个客户支持助手..."
  model:
    provider: openai
    name: gpt-4o
  tools:
    - name: ticket-tool
      refName: support.ticket-tool
  memory:
    enabled: true
    type: vector
```

### 工作流资源

```yaml
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: order-processing
  namespace: default
spec:
  name: "订单处理流程"
  initialStep: "validate-order"
  steps:
    - id: "validate-order"
      name: "验证订单"
      type: "agent"
      agentId: "order-validator"
      transitions:
        true: "process-payment"
        false: "handle-validation-error"
    - id: "process-payment"
      name: "处理支付"
      type: "function"
      function: "processPayment"
      transitions:
        next: "confirm-order"
    - id: "confirm-order"
      name: "确认订单"
      type: "agent"
      agentId: "order-confirmer"
    - id: "handle-validation-error"
      name: "处理验证错误"
      type: "agent"
      agentId: "error-handler"
```

### 网络资源

```yaml
apiVersion: mastra.ai/v1
kind: Network
metadata:
  name: customer-service
  namespace: default
spec:
  instructions: "客户服务网络，协调多个专业代理解决客户问题"
  agents:
    - name: greeter
      ref: default.greeter-agent
      role: Greeter
      responsibilities:
        - "初步问候客户"
        - "理解客户的核心问题"
    - name: technical
      ref: default.technical-agent
      role: TechnicalSupport
      responsibilities:
        - "解决技术相关问题"
    - name: billing
      ref: default.billing-agent
      role: BillingSupport
      responsibilities:
        - "处理账单和付款问题"
  router:
    model:
      provider: openai
      name: gpt-4o
    routingStrategy: "SemanticMatching"
    maxSteps: 10
```

### MastraPod资源

```yaml
apiVersion: mastra.ai/v1
kind: MastraPod
metadata:
  name: support-system
  namespace: default
spec:
  providers:
    openai:
      apiKey: ${env.OPENAI_API_KEY}
  memory:
    type: postgres
    config:
      connectionString: ${env.PG_CONNECTION_STRING}
  resources:
    # 内联资源定义
    - apiVersion: mastra.ai/v1
      kind: Agent
      metadata:
        name: greeter-agent
      spec:
        instructions: "你是迎宾智能体，负责初步了解客户问题..."
        model:
          provider: openai
          name: gpt-4o
    
    # 外部文件引用
    - file: ./agents/technical-agent.yaml
    
    # 目录引用
    - directory: ./tools
    
    # 模式匹配
    - pattern: "./workflows/*.yaml"
```

## 扩展功能

未来版本的CLI将包括以下增强功能：

1. 资源删除命令
2. 资源状态监控
3. 执行历史查看
4. 交互式调试工具
5. 资源导出和导入

## 故障排除

如果遇到问题，请尝试以下方法：

1. 使用`--verbose`选项获取更详细的日志输出
2. 检查资源定义是否符合架构要求
3. 验证模型提供商和内存等配置是否正确
4. 确保引用的资源已被加载

有关更多信息，请参阅[Mastra Runtimes文档](./index.md)。 