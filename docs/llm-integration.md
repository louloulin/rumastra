# Mastra LLM 集成指南

## 概述

Mastra Runtime 支持通过声明式 API 配置和管理 LLM 模型，使用 Kubernetes 风格的资源定义格式。本文档介绍如何在 Mastra 中配置、部署和使用 LLM 模型。

## LLM 资源定义

### 基本结构

LLM 配置遵循 `RuntimeResource` 接口，采用统一的 Kubernetes 风格声明式结构：

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: my-gpt4-model
  namespace: default
  labels:
    type: conversational
    tier: premium
spec:
  provider: openai
  model: gpt-4o
  apiKey: ${OPENAI_API_KEY}
  options:
    temperature: 0.7
    maxTokens: 2000
```

### 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `apiVersion` | API 版本，固定为 `mastra.ai/v1` | `mastra.ai/v1` |
| `kind` | 资源类型，固定为 `LLM` | `LLM` |
| `metadata.name` | 资源名称，用于引用 | `my-gpt4-model` |
| `metadata.namespace` | 命名空间，可选 | `default` |
| `metadata.labels` | 标签，用于资源筛选 | `{ type: "conversational" }` |
| `spec.provider` | LLM 提供商 | `openai`, `anthropic`, `google`, `groq`, `qwen` |
| `spec.model` | 模型名称 | `gpt-4o`, `claude-3-opus`, `gemini-1.5-pro` |
| `spec.apiKey` | API 密钥，支持环境变量引用 | `${OPENAI_API_KEY}` |
| `spec.options` | 提供商特定选项 | `{ temperature: 0.7 }` |

## 支持的 LLM 提供商

### OpenAI

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: openai-gpt4
spec:
  provider: openai
  model: gpt-4o
  apiKey: ${OPENAI_API_KEY}
  options:
    temperature: 0.7
    maxTokens: 4000
```

### Anthropic

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: anthropic-claude
spec:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  apiKey: ${ANTHROPIC_API_KEY}
  options:
    maxTokens: 4000
```

### Google

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: google-gemini
spec:
  provider: google
  model: gemini-1.5-pro-latest
  apiKey: ${GOOGLE_API_KEY}
```

### Groq

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: groq-llama
spec:
  provider: groq
  model: llama-3.1-70b-versatile
  apiKey: ${GROQ_API_KEY}
  options:
    temperature: 0.5
```

### Qwen

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: qwen-model
spec:
  provider: qwen
  model: qwen-max
  apiKey: ${QWEN_API_KEY}
  options:
    baseURL: https://dashscope.aliyuncs.com/api/v1
```

## 在代码中使用 LLM

### 加载 LLM 资源

```typescript
import { RuntimeManager } from 'rumastra';

// 创建运行时管理器
const runtimeManager = new RuntimeManager();

// 方法1: 加载 YAML 文件
await runtimeManager.loadFromFile('path/to/llm-config.yaml');

// 方法2: 加载 YAML 字符串
const yamlContent = `
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: my-llm
spec:
  provider: openai
  model: gpt-4o
`;
await runtimeManager.loadFromString(yamlContent);

// 获取 LLM 模型
const llm = runtimeManager.getLLM('default.my-llm');
```

### 使用 YAML 转 LLM 功能

```typescript
import { yamlToMastraLLM } from 'rumastra';

const yamlContent = `
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: yaml-llm
spec:
  provider: openai
  model: gpt-4o
`;

// 直接从 YAML 创建 LLM 模型
const model = await yamlToMastraLLM(yamlContent);

// 使用模型生成内容
// model.client 是对应提供商的客户端实例
```

## 与代理和工作流集成

LLM 可以与 Mastra Agent 和 Workflow 轻松集成：

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
spec:
  instructions: "你是一个助手..."
  model:
    ref: default.my-llm  # 引用上面定义的 LLM 资源
```

## 环境变量支持

LLM 资源配置支持环境变量引用，格式为 `${ENV_NAME}`。例如：

```yaml
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: env-api-llm
spec:
  provider: anthropic
  model: claude-3-opus
  apiKey: ${ANTHROPIC_API_KEY}
```

确保在运行时环境中设置了相应的环境变量。 