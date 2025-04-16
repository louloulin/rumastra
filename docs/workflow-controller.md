# WorkflowController

## 概述

`WorkflowController` 是 Mastra Runtimes 的核心组件之一，负责管理工作流资源的生命周期。它实现了一个类似 Kubernetes 控制器的模式，通过协调工作流资源的期望状态和当前状态，确保工作流按照预期执行。

工作流控制器集成了资源调度器（ResourceScheduler），支持工作流步骤的优先级排序、并发控制和错误处理。

## 主要功能

- **工作流生命周期管理**：创建、更新、删除和执行工作流
- **步骤依赖解析**：处理工作流步骤之间的依赖关系
- **事件驱动执行**：使用事件总线通知工作流和步骤状态变化
- **错误处理和恢复**：处理步骤执行失败和重试
- **资源状态管理**：监控和更新工作流资源状态

## 工作流定义示例

一个典型的工作流资源定义如下：

```yaml
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: customer-support-workflow
  namespace: default
spec:
  name: "客户支持流程"
  description: "处理客户支持请求的标准流程"
  steps:
    - id: greeting
      name: "问候客户"
      agent: support.greeter-agent
      next: issue-classification
    - id: issue-classification
      name: "问题分类"
      agent: support.classifier-agent
      next: [technical-support, billing-support]
    - id: technical-support
      name: "技术支持"
      agent: support.technical-agent
    - id: billing-support
      name: "账单支持"
      agent: support.billing-agent
  initialStep: greeting
```

## 使用方法

### 创建工作流控制器

```typescript
import { EventBus } from 'rumastra/core/eventbus';
import { WorkflowController } from 'rumastra/core/workflow/controller';
import { ResourceScheduler } from 'rumastra/core/scheduler/resource-scheduler';

// 创建事件总线
const eventBus = new EventBus();

// 可选：创建自定义资源调度器
const scheduler = new ResourceScheduler({
  maxConcurrentTasks: 5,
  defaultTaskTimeoutMs: 30000
});

// 创建工作流控制器
const workflowController = new WorkflowController(eventBus, { scheduler });
```

### 注册和监控工作流资源

```typescript
// 创建工作流资源
import { createWorkflowResource } from 'rumastra/types';

const workflowResource = createWorkflowResource('my-workflow', {
  name: "示例工作流",
  description: "这是一个示例工作流",
  steps: [
    // 步骤定义
  ],
  initialStep: "first-step"
});

// 开始监控工作流资源
workflowController.watch(workflowResource);
```

### 执行工作流

```typescript
// 方法1：直接调用执行方法
try {
  const result = await workflowController.executeWorkflow('my-workflow', {
    // 执行上下文
    input: "用户问题",
    parameters: {
      // 自定义参数
    }
  });
  
  console.log('工作流执行完成:', result);
} catch (error) {
  console.error('工作流执行失败:', error);
}

// 方法2：通过事件触发执行
eventBus.publish('workflow.execute', {
  workflowId: 'my-workflow',
  context: {
    // 执行上下文
  }
});

// 监听执行结果
eventBus.subscribe('workflow.execute.result', (result) => {
  if (result.success) {
    console.log('工作流执行成功:', result.result);
  } else {
    console.error('工作流执行失败:', result.error);
  }
});
```

### 监听工作流事件

```typescript
// 监听工作流开始
eventBus.subscribe('workflow.started', (data) => {
  console.log(`工作流 ${data.name} (${data.workflowId}) 开始执行`);
});

// 监听工作流完成
eventBus.subscribe('workflow.completed', (data) => {
  console.log(`工作流 ${data.name} (${data.workflowId}) 执行完成:`, data.result);
});

// 监听工作流失败
eventBus.subscribe('workflow.failed', (data) => {
  console.error(`工作流 ${data.name} (${data.workflowId}) 执行失败:`, data.error);
});

// 监听步骤开始
eventBus.subscribe('workflow.step.started', (data) => {
  console.log(`步骤 ${data.name} (${data.stepId}) 开始执行`);
});

// 监听步骤完成
eventBus.subscribe('workflow.step.completed', (data) => {
  console.log(`步骤 ${data.name} (${data.stepId}) 执行完成:`, data.result);
});
```

## 实现细节

### 协调循环

WorkflowController 实现了 AbstractController 的协调循环机制，定期检查工作流资源的期望状态和当前状态，并执行必要的操作使实际状态与期望状态一致。

协调循环的主要步骤：

1. **获取期望状态**：解析工作流配置，验证步骤依赖关系
2. **获取当前状态**：检查工作流是否正在运行，当前执行到哪个步骤
3. **更新资源状态**：根据当前执行情况更新工作流资源的状态
4. **发布状态变更事件**：通知其他组件工作流状态变化

### 工作流执行机制

工作流执行采用事件驱动和资源调度器协同工作的模式：

1. 工作流执行请求通过事件或直接调用触发
2. 控制器获取工作流定义，并从初始步骤开始执行
3. 每个步骤通过资源调度器提交执行任务
4. 步骤执行完成后，根据步骤定义的 next 字段确定下一步
5. 执行过程中的状态变化通过事件总线通知
6. 执行完成或失败时更新工作流状态，并发布相应事件

### 错误处理

1. **步骤执行失败**：捕获异常并发布步骤失败事件，默认情况下整个工作流会失败
2. **工作流取消**：支持通过取消函数终止正在执行的工作流
3. **资源协调错误**：处理资源验证、解析过程中的错误
4. **任务调度错误**：集成资源调度器的错误处理机制

## 最佳实践

1. **分解复杂工作流**：将复杂流程分解为清晰、独立的步骤
2. **定义明确的步骤边界**：每个步骤应该有明确的输入和输出
3. **利用事件监听**：通过订阅事件来监控工作流执行过程
4. **实现幂等性**：确保步骤可以安全地重试执行
5. **合理设置优先级**：对关键步骤设置更高的优先级
6. **做好异常处理**：妥善处理各个步骤可能出现的异常情况

## 限制和注意事项

1. 当前实现主要支持顺序执行和简单的分支流程
2. 复杂的条件执行和循环需要在步骤内部实现
3. 工作流状态持久化依赖于运行时管理器的存储机制
4. 大型工作流建议拆分为多个小型工作流，避免单个工作流过于复杂 