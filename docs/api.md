# Mastra Runtimes API 参考

本文档提供了 Mastra Runtimes 的详细 API 参考。

## 核心 API

### 配置加载

```typescript
import { loadFromFile, loadFromString, loadFromConfig } from '@mastra/runtimes';

// 从文件加载
const runtime = await loadFromFile('./config.yaml');

// 从字符串加载
const yamlString = `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
spec:
  # ...
`;
const runtime = await loadFromString(yamlString);

// 从配置对象加载
const runtime = await loadFromConfig(configObject);
```

### RuntimeManager

RuntimeManager 是 Mastra Runtimes 的核心类，负责管理所有资源和控制器。

```typescript
import { RuntimeManager } from '@mastra/runtimes';

// 创建实例
const runtimeManager = new RuntimeManager();

// 注册控制器
runtimeManager.registerController('Agent', new AgentController(eventBus));

// 添加资源
await runtimeManager.addResource(agentResource);

// 添加代理
runtimeManager.addAgent('agent1', myAgent);

// 获取网络
const network = runtimeManager.getNetwork('default.my-network');

// 获取工作流
const workflow = runtimeManager.getWorkflow('default.my-workflow');
```

### EventBus

EventBus 实现了事件驱动架构的核心组件，用于组件间通信。

```typescript
import { EventBus } from '@mastra/runtimes';

// 创建事件总线
const eventBus = new EventBus();

// 发布事件
eventBus.publish('topic.event', { data: 'value' });

// 订阅事件
const subscription = eventBus.subscribe('topic.event', (data) => {
  console.log('Received event:', data);
});

// 取消订阅
subscription.unsubscribe();

// 清除主题
eventBus.clearTopic('topic.event');

// 清除所有
eventBus.clearAll();
```

## 资源控制器

### AbstractController

抽象控制器类，提供了基本的控制器实现。

```typescript
import { AbstractController } from '@mastra/runtimes';

class MyController extends AbstractController<MyResource> {
  async getDesiredState(resource: MyResource): Promise<any> {
    // 实现获取期望状态的逻辑
    return { /* ... */ };
  }
  
  async getCurrentState(resource: MyResource): Promise<any> {
    // 实现获取当前状态的逻辑
    return { /* ... */ };
  }
  
  protected async updateResourceState(
    resource: MyResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    // 实现状态更新逻辑
  }
  
  protected async cleanupResource(resource: MyResource): Promise<void> {
    // 实现资源清理逻辑
  }
}
```

### AgentController

代理控制器，管理代理资源的生命周期。

```typescript
import { AgentController } from '@mastra/runtimes';

// 创建控制器
const agentController = new AgentController(eventBus);

// 监视资源
agentController.watch(agentResource);

// 协调资源
await agentController.reconcile(agentResource);
```

### WorkflowController

工作流控制器，管理工作流资源的生命周期。

```typescript
import { WorkflowController } from '@mastra/runtimes';

// 创建控制器
const workflowController = new WorkflowController(eventBus);

// 监视资源
workflowController.watch(workflowResource);

// 协调资源
await workflowController.reconcile(workflowResource);
```

### NetworkController

网络控制器，管理网络资源的生命周期。

```typescript
import { NetworkController } from '@mastra/runtimes';

// 创建控制器
const networkController = new NetworkController(eventBus, stateStore);

// 监视资源
networkController.watch(networkResource);

// 协调资源
await networkController.reconcile(networkResource);
```

## 执行器

### WorkflowExecutor

工作流执行器，负责执行工作流步骤。

```typescript
import { WorkflowExecutor } from '@mastra/runtimes';

// 创建执行器
const executor = new WorkflowExecutor(workflowResource, agentMap);

// 执行工作流
const result = await executor.execute({
  input: { /* 输入变量 */ },
  context: { /* 上下文变量 */ },
  onStepExecute: (stepId, input, output) => {
    console.log(`执行步骤: ${stepId}`);
  },
  onComplete: (result) => {
    console.log('工作流完成:', result);
  },
  onError: (error) => {
    console.error('工作流错误:', error);
  }
});

// 获取变量
const variables = executor.getVariables();

// 获取执行历史
const history = executor.getHistory();
```

### NetworkExecutor

网络执行器，负责执行网络生成。

```typescript
import { NetworkExecutor } from '@mastra/runtimes';

// 创建执行器
const executor = new NetworkExecutor(networkResource, agentsMap, routerAgent);

// 执行生成
const result = await executor.generate('用户输入', {
  initialState: { /* 初始状态 */ },
  maxSteps: 10,
  temperature: 0.7
});

// 执行流式生成
const streamResult = await executor.stream('用户输入', {
  initialState: { /* 初始状态 */ },
  maxSteps: 10,
  temperature: 0.7,
  onFinish: (finalText) => {
    console.log('生成完成:', finalText);
  }
});

// 获取状态
const state = executor.getState();

// 更新状态
executor.updateState({ key: 'value' });

// 获取步骤计数
const stepCount = executor.getStepCount();

// 获取可用代理
const agents = executor.getAgents();
```

## 状态管理

### NetworkState

网络状态类，用于管理网络执行的状态。

```typescript
import { NetworkState } from '@mastra/runtimes';

// 创建状态
const state = new NetworkState({ initialKey: 'initialValue' });

// 获取值
const value = state.get('key');

// 设置值
state.set('key', 'value');

// 更新多个值
state.update({ key1: 'value1', key2: 'value2' });

// 检查键是否存在
const hasKey = state.has('key');

// 删除键
state.delete('key');

// 清空状态
state.clear();

// 转换为对象
const stateObject = state.toObject();
```

### NetworkStateStore

网络状态存储接口，用于持久化网络状态。

```typescript
import { InMemoryNetworkStateStore, NetworkStateStore } from '@mastra/runtimes';

// 创建内存存储
const stateStore = new InMemoryNetworkStateStore();

// 获取状态值
const value = await stateStore.getValue('networkId', 'key');

// 设置状态值
await stateStore.setValue('networkId', 'key', 'value');

// 更新多个值
await stateStore.updateValues('networkId', { key1: 'value1', key2: 'value2' });

// 获取完整状态
const state = await stateStore.getNetworkState('networkId');

// 监听状态变化
const subscription = stateStore.watchState('networkId', (state) => {
  console.log('状态变化:', state);
});
```

## 资源类型

### RuntimeResource

所有资源类型的基础接口。

```typescript
interface RuntimeResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: unknown;
  status?: unknown;
}
```

### AgentResource

代理资源类型。

```typescript
interface AgentResource extends RuntimeResource {
  kind: 'Agent';
  spec: {
    name: string;
    instructions: string;
    model: {
      provider: string;
      name: string;
    };
    tools?: Record<string, string>;
    memory?: {
      enabled?: boolean;
      type?: string;
      config?: Record<string, any>;
    };
    voice?: {
      enabled?: boolean;
      provider?: string;
      config?: Record<string, any>;
    };
  };
  status?: {
    phase: 'Pending' | 'Running' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
  };
}
```

### WorkflowResource

工作流资源类型。

```typescript
interface WorkflowResource extends RuntimeResource {
  kind: 'Workflow';
  spec: {
    name: string;
    description?: string;
    steps: {
      id: string;
      name: string;
      agent: string;
      input?: Record<string, any>;
      output?: Record<string, any>;
      next?: string | string[];
    }[];
    initialStep: string;
  };
  status?: {
    phase: 'Pending' | 'Running' | 'Completed' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
    currentStep?: string;
  };
}
```

### NetworkResource

网络资源类型。

```typescript
interface NetworkResource extends RuntimeResource {
  kind: 'Network';
  spec: {
    instructions?: string;
    agents: {
      name: string;
      ref: string;
    }[];
    router: {
      model: {
        provider: string;
        name: string;
      };
      maxSteps?: number;
    };
    state?: {
      persistence?: boolean;
      ttl?: number;
    };
  };
  status?: {
    phase: 'Pending' | 'Running' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
    stepCount?: number;
  };
}
```

## 辅助函数

### 资源创建辅助函数

```typescript
import {
  createAgentResource,
  createToolResource,
  createWorkflowResource,
  createNetworkResource
} from '@mastra/runtimes';

// 创建代理资源
const agentResource = createAgentResource('my-agent', {
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: {
    provider: 'openai',
    name: 'gpt-4'
  }
});

// 创建工作流资源
const workflowResource = createWorkflowResource('my-workflow', {
  name: 'My Workflow',
  initialStep: 'step1',
  steps: [
    // ...
  ]
});

// 创建网络资源
const networkResource = createNetworkResource('my-network', {
  instructions: 'A network of experts',
  agents: [
    // ...
  ],
  router: {
    model: {
      provider: 'openai',
      name: 'gpt-4'
    }
  }
});
``` 