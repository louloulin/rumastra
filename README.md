# Mastra Runtimes

Mastra Runtimes 是一个模块化、声明式的 AI 应用运行时系统，提供了基于 Kubernetes 风格的资源管理模型。它支持代理、工具、工作流和智能体网络的声明式配置、管理和执行。

## 主要特性

- **声明式配置**：使用 YAML 定义和管理所有资源
- **控制器模式**：采用 Kubernetes 风格的控制器管理资源生命周期
- **事件驱动架构**：基于事件总线实现组件间松耦合通信
- **资源状态管理**：跟踪和管理所有资源的状态和条件
- **模块化设计**：核心功能拆分为多个模块，便于扩展和维护
- **多种编排模式**：支持静态工作流和动态智能体网络

## 安装

```bash
# 使用 npm
npm install kastra

# 使用 pnpm
pnpm add kastra
```

## 架构概览

Mastra Runtimes 基于以下核心组件构建：

- **RuntimeManager**：中央管理器，负责资源和控制器的统一管理
- **EventBus**：事件总线，实现组件间松耦合通信
- **Controller**：资源控制器，管理特定资源类型的生命周期
- **执行引擎**：执行工作流和智能体网络的核心引擎

支持的资源类型：

- **Agent**：定义智能代理及其特性
- **Tool**：定义可被代理使用的工具
- **Workflow**：定义静态执行流程
- **Network**：定义智能体网络及其动态交互模式

## 快速开始

### 工作流示例

```typescript
import { loadFromString } from 'kastra';

// 创建工作流资源
const workflowYaml = `
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: simple-workflow
spec:
  name: 简单工作流
  initialStep: step1
  steps:
    - id: step1
      name: 第一步
      agent: agent1
      next: step2
    - id: step2
      name: 第二步
      agent: agent2
      next: END
`;

async function runWorkflow() {
  // 加载工作流
  const runtime = await loadFromString(workflowYaml);
  
  // 添加代理
  runtime.addAgent('agent1', myAgent1);
  runtime.addAgent('agent2', myAgent2);
  
  // 执行工作流
  const workflow = runtime.getWorkflow('default.simple-workflow');
  const result = await workflow.execute({
    input: { query: '用户输入' },
    onStepExecute: (stepId, input, output) => {
      console.log(`执行步骤: ${stepId}`);
    }
  });
  
  console.log('工作流结果:', result.output);
}
```

### 智能体网络示例

```typescript
import { loadFromString } from 'kastra';

// 创建网络资源
const networkYaml = `
apiVersion: mastra.ai/v1
kind: Network
metadata:
  name: expert-network
spec:
  instructions: "专家网络，由多个专业智能体组成"
  agents:
    - name: researcher
      ref: agents/researcher
    - name: writer
      ref: agents/writer
    - name: critic
      ref: agents/critic
  router:
    model:
      provider: openai
      name: gpt-4
    maxSteps: 5
`;

async function runNetwork() {
  // 加载网络
  const runtime = await loadFromString(networkYaml);
  
  // 添加代理
  runtime.addAgent('agents/researcher', researcherAgent);
  runtime.addAgent('agents/writer', writerAgent);
  runtime.addAgent('agents/critic', criticAgent);
  
  // 路由器代理
  runtime.addAgent('router', routerAgent);
  
  // 执行网络
  const network = runtime.getNetwork('default.expert-network');
  const result = await network.generate('我需要一篇关于人工智能的研究文章');
  
  console.log('网络结果:', result.text);
}
```

## 全功能示例

```typescript
import { loadFromFile, RuntimeManager } from 'kastra';

async function main() {
  // 从文件加载配置
  const runtime = await loadFromFile('./config.yaml');
  
  // 或者手动创建并配置 RuntimeManager
  const manualRuntime = new RuntimeManager();
  
  // 添加代理
  manualRuntime.addAgent('agent1', myAgent1);
  
  // 添加资源
  await manualRuntime.addResource(myAgentResource);
  await manualRuntime.addResource(myWorkflowResource);
  await manualRuntime.addResource(myNetworkResource);
  
  // 获取并执行资源
  const workflow = manualRuntime.getWorkflow('default.my-workflow');
  const result = await workflow.execute();
  
  console.log('执行结果:', result);
}
```

## 资源定义参考

### Agent 资源

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
  namespace: default
spec:
  name: "我的代理"
  instructions: "你是一个助手，帮助用户解决问题。"
  model:
    provider: openai
    name: gpt-4
  tools:
    tool1: "tools/tool1"
    tool2: "tools/tool2"
  memory:
    enabled: true
    type: "vector"
```

### Workflow 资源

```yaml
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: my-workflow
spec:
  name: "我的工作流"
  description: "一个简单的工作流示例"
  initialStep: "step1"
  steps:
    - id: "step1"
      name: "第一步"
      agent: "agent1"
      input:
        prompt: "分析以下内容"
      output:
        analysis: "text"
      next: "step2"
    - id: "step2"
      name: "第二步"
      agent: "agent2"
      input:
        data: "$analysis"
      next: "END"
```

### Network 资源

```yaml
apiVersion: mastra.ai/v1
kind: Network
metadata:
  name: my-network
spec:
  instructions: "一个由多个专家组成的网络"
  agents:
    - name: "expert1"
      ref: "agents/expert1"
    - name: "expert2"
      ref: "agents/expert2"
  router:
    model:
      provider: openai
      name: gpt-4
    maxSteps: 10
  state:
    persistence: true
    ttl: 3600
```

## API 参考

详细的 API 参考文档可在 [API 文档](./docs/api.md) 中查看。

## 贡献

欢迎贡献代码、报告问题或提出改进建议！请参阅 [贡献指南](./CONTRIBUTING.md) 获取更多信息。

## 许可证

MIT 

## 嵌套配置：MastraPod

MastraPod 是 Mastra 运行时的声明式配置系统，允许用户在一个中心配置文件中定义和管理所有 Mastra 资源。

### 基本结构

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: my-mastra-pod
  namespace: default

# 全局提供者配置
providers:
  openai:
    apiKey: ${env.OPENAI_API_KEY}
  anthropic:
    apiKey: ${env.ANTHROPIC_API_KEY}

# 全局内存配置
memory:
  type: redis
  url: ${REDIS_URL}

# 日志配置
logging:
  level: info
  format: json

# 资源引用
resources:
  # 内联定义
  - apiVersion: mastra/v1
    kind: Agent
    metadata:
      name: simple-agent
    spec:
      name: SimpleAgent
      instructions: "A simple agent"
      model:
        provider: openai
        name: gpt-4
  
  # 从文件引用
  - file: ./agents/weather-agent.yaml
  
  # 从目录引用（加载所有yaml文件）
  - directory: ./tools
    pattern: "*.yaml"
  
  # 条件加载
  - file: ./agents/premium-agent.yaml
    when: ${env.PREMIUM_ENABLED}
```

### 使用方法

1. 创建一个 `mastrapod.yaml` 文件作为主配置入口
2. 定义全局配置，如提供商API密钥、内存设置和日志级别
3. 通过内联定义、文件引用或目录引用添加资源

### 示例代码

```javascript
import { CLIRuntimeManager } from 'kastra';

async function runWithMastraPod() {
  // 创建运行时管理器
  const runtimeManager = new CLIRuntimeManager();
  await runtimeManager.initialize();
  
  // 解析MastraPod配置
  const podPath = './mastrapod.yaml';
  const { podConfig, resources } = await runtimeManager.parseMastraPod(podPath);
  
  // 应用全局配置
  await runtimeManager.applyGlobalConfig(podConfig);
  
  // 加载所有资源
  for (const resource of resources) {
    await runtimeManager.loadResource(resource);
  }
  
  // 执行工作流
  const workflow = resources.find(r => r.kind === 'Workflow' && r.metadata.name === 'my-workflow');
  if (workflow) {
    await runtimeManager.executeWorkflow(workflow);
  }
  
  // 清理资源
  await runtimeManager.cleanup();
}
```

### 资源引用与依赖关系

MastraPod 支持在资源之间创建引用和依赖关系：

```yaml
# agents/support-agent.yaml
apiVersion: mastra/v1
kind: Agent
metadata:
  name: support-agent
spec:
  name: SupportAgent
  instructions: "A support agent"
  model:
    provider: openai
    name: gpt-4
  tools:
    - $ref: tools/ticket-tool
    - $ref: tools/kb-search-tool
``` 

## 组件

### TypedEventBus

TypedEventBus是一个基于TypeScript类型系统的事件总线实现，提供类型安全的事件发布和订阅机制。

#### 特性

- 类型安全: 在编译时检查事件名称和事件载荷类型
- 符合事件驱动设计模式
- 支持完整的事件生命周期管理
- 错误处理: 隔离事件处理器错误，防止错误传播
- 简洁API: 提供链式调用和函数式风格API

#### 用法

首先，定义事件类型：

```typescript
interface AppEvents {
  'user:login': { userId: string; timestamp: number };
  'user:logout': { userId: string; timestamp: number };
  'data:updated': { resource: string; changes: Record<string, any> };
}
```

创建事件总线实例：

```typescript
import { EventBus } from 'kastra';

const eventBus = new EventBus<AppEvents>();
```

订阅事件：

```typescript
// 基本订阅
const unsubscribe = eventBus.on('user:login', (data) => {
  console.log(`User ${data.userId} logged in at ${data.timestamp}`);
});

// 一次性订阅
eventBus.once('user:logout', (data) => {
  console.log(`User ${data.userId} logged out at ${data.timestamp}`);
});
```

发布事件：

```typescript
eventBus.emit('user:login', { 
  userId: 'user123',
  timestamp: Date.now()
});
```

取消订阅：

```typescript
// 使用订阅返回的取消函数
unsubscribe();

// 或者使用off方法
const handler = (data: AppEvents['data:updated']) => {
  console.log(`Resource ${data.resource} was updated`);
};
eventBus.on('data:updated', handler);
// 稍后取消订阅
eventBus.off('data:updated', handler);
```

清除监听器：

```typescript
// 清除特定事件的所有监听器
eventBus.clear('user:login');

// 清除所有事件的监听器
eventBus.clear();
```

获取监听器数量：

```typescript
const count = eventBus.listenerCount('user:login');
console.log(`Number of login listeners: ${count}`);
```

## 贡献

欢迎提交PR和Issue来帮助改进这个项目。 