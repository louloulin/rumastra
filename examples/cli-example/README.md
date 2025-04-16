# Mastra Runtimes CLI 示例

这个示例展示了如何使用Mastra Runtimes CLI工具来管理和执行基于DSL的资源。

## 目录结构

```
cli-example/
├── README.md           # 本文档
├── config.json         # 全局配置
├── resources/          # 资源定义目录
│   ├── agents/         # 代理资源
│   │   ├── greeter.yaml
│   │   ├── technical.yaml
│   │   └── billing.yaml
│   ├── tools/          # 工具资源
│   │   ├── ticket.yaml
│   │   └── knowledge.yaml
│   ├── workflows/      # 工作流资源
│   │   ├── support.yaml
│   │   └── billing.yaml
│   └── networks/       # 网络资源
│       └── customer-support.yaml
└── pod.yaml            # MastraPod配置
```

## 快速开始

1. 安装CLI工具（如果尚未安装）

```bash
npm install -g rumastra
```

2. 应用MastraPod配置

```bash
cd examples/cli-example
mastra apply --config ./config.json ./pod.yaml
```

3. 执行客户支持网络

```bash
mastra run network customer-support --input "我的账单有问题，上个月被多收费了"
```

## 资源说明

### 代理资源

示例包含三个代理资源：

- **greeter.yaml**: 迎宾代理，负责初步问候和理解用户问题
- **technical.yaml**: 技术支持代理，解决技术相关问题
- **billing.yaml**: 账单支持代理，处理账单和付款问题

### 工具资源

示例包含两个工具资源：

- **ticket.yaml**: 工单处理工具，用于创建和更新工单
- **knowledge.yaml**: 知识库工具，用于查询产品和服务信息

### 工作流资源

示例包含两个工作流资源：

- **support.yaml**: 客户支持工作流，处理客户支持请求的流程
- **billing.yaml**: 账单处理工作流，处理账单相关请求的流程

### 网络资源

示例包含一个网络资源：

- **customer-support.yaml**: 客户支持网络，协调多个专业代理解决客户问题

## 使用示例

### 应用单个资源

```bash
# 应用单个代理资源
mastra apply --config ./config.json ./resources/agents/greeter.yaml
```

### 应用整个目录

```bash
# 应用所有代理资源
mastra apply --config ./config.json ./resources/agents/
```

### 递归应用目录

```bash
# 递归应用所有资源
mastra apply --recursive --config ./config.json ./resources/
```

### 执行特定代理

```bash
# 执行迎宾代理
mastra run agent greeter --input "你好，我需要帮助"
```

### 执行工作流

```bash
# 执行客户支持工作流
mastra run workflow support --input "我的产品有问题，需要维修"
```

### 查询资源状态

```bash
# 查询所有代理
mastra get agent

# 查询特定代理
mastra get agent greeter
```

## 自定义和扩展

您可以通过修改`resources`目录中的YAML文件或创建新文件来自定义资源定义。例如，您可以：

1. 调整代理的指令或模型
2. 添加更多工具资源
3. 修改工作流步骤
4. 更改网络的路由策略

详细的资源定义语法和选项，请参考[Mastra Runtimes文档](../../docs/index.md)。 