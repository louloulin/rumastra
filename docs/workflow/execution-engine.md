# 工作流执行引擎

工作流执行引擎（WorkflowExecutor）是 Mastra Runtimes 中负责执行工作流的核心组件。它提供了强大的功能来管理工作流执行过程，确保工作流能够稳定可靠地运行。

## 主要特性

### 错误处理

工作流执行引擎提供了全面的错误处理机制，确保工作流执行过程中遇到错误时能够被妥善处理：

- **错误捕获与分类**：对执行过程中不同类型的错误进行捕获和分类
- **错误回调**：支持自定义错误处理回调函数
- **详细的错误信息**：在执行结果中提供详细的错误信息，包括错误位置、类型和消息
- **状态更新**：当发生错误时自动更新工作流状态

### 步骤超时与重试

为了处理不稳定的外部服务或临时性错误，执行引擎支持灵活的超时和重试配置：

- **步骤级超时**：每个工作流步骤可以单独配置超时时间
- **全局默认超时**：为所有步骤提供默认的超时设置
- **自动重试**：对失败的步骤进行自动重试
- **重试策略**：支持配置最大重试次数和重试间隔
- **重试状态记录**：记录每次重试的结果和状态

### 执行历史记录

完整的执行历史记录功能，帮助开发者了解和分析工作流的执行过程：

- **步骤执行记录**：记录每个步骤的执行详情
- **时间信息**：包括开始时间、结束时间和执行持续时间
- **输入输出**：记录每个步骤的输入和输出数据
- **尝试记录**：当步骤重试时，记录每次尝试的结果
- **历史查询**：提供方法在执行过程中获取当前历史记录

### 性能优化

工作流执行引擎提供了以下性能优化功能：

- **缓存机制**：缓存步骤执行结果，减少重复计算
- **批处理**：将多个相似操作批量处理，提高吞吐量
- **异步执行**：支持非阻塞式执行，提高并行处理能力

## 使用示例

### 基本用法

```typescript
// 创建工作流执行器
const executor = new WorkflowExecutor(workflowResource, agentsMap);

// 执行工作流
const result = await executor.execute();

// 检查执行结果
if (result.status === 'completed') {
  console.log('工作流成功完成', result.output);
} else {
  console.error('工作流执行失败', result.error);
}

// 查看执行历史
console.log('执行历史:', result.history);
```

### 配置超时和重试

可以在工作流步骤中配置超时和重试行为：

```typescript
const workflowWithRetry = {
  apiVersion: 'mastra.ai/v1',
  kind: 'Workflow',
  metadata: {
    name: 'retry-workflow'
  },
  spec: {
    name: 'Retry Workflow',
    initialStep: 'step1',
    steps: [
      {
        id: 'step1',
        name: 'Retryable Step',
        type: 'agent',
        agentId: 'some-agent',
        // 超时设置（毫秒）
        timeout: 5000,
        // 最大重试次数
        retries: 3,
        // 重试间隔（毫秒）
        retryDelayMs: 1000,
        input: {
          message: 'Hello'
        }
      }
    ]
  }
};
```

也可以在执行选项中设置全局默认值：

```typescript
const options = {
  // 默认步骤超时时间（毫秒）
  defaultStepTimeoutMs: 10000,
  // 默认最大重试次数
  defaultStepRetries: 2,
  // 默认重试间隔（毫秒）
  defaultStepRetryDelayMs: 500,
  // 错误回调
  onError: (error) => {
    console.error('执行出错:', error);
  }
};

const result = await executor.execute(options);
```

### 执行历史查询

在执行过程中可以获取当前的执行历史：

```typescript
const options = {
  onStepExecute: (stepId, input, output) => {
    // 获取当前执行历史
    const history = executor.getHistory();
    console.log(`步骤 ${stepId} 执行后的历史:`, history);
  }
};

await executor.execute(options);
```

### 性能优化配置

```typescript
// 启用缓存
executor.enableCaching({
  ttl: 3600000, // 缓存生存时间（毫秒）
  maxSize: 1000, // 最大缓存条目数
});

// 配置批处理
executor.configBatchProcessing({
  maxBatchSize: 50, // 最大批处理大小
  processingInterval: 100, // 批处理间隔（毫秒）
});

// 配置异步执行
executor.configAsyncExecution({
  maxConcurrent: 10, // 最大并发执行数
  priorityLevels: 3, // 优先级级别数
});
```

## 执行结果

执行结果包含详细的信息：

```typescript
interface WorkflowExecuteResult {
  // 执行状态: 'completed'|'failed'|'running'|'timeout'
  status: string;
  
  // 最终输出数据
  output: any;
  
  // 执行历史记录
  history: StepExecutionRecord[];
  
  // 错误信息（如果有）
  error?: any;
  
  // 当前/最后执行的步骤ID
  currentStep?: string;
  
  // 开始执行时间
  startTime: string;
  
  // 执行结束时间
  endTime: string;
  
  // 执行持续时间(毫秒)
  durationMs: number;
}

interface StepExecutionRecord {
  // 步骤ID
  stepId: string;
  
  // 步骤输入
  input: any;
  
  // 步骤输出
  output: any;
  
  // 开始执行时间
  startTime: string;
  
  // 执行结束时间
  endTime: string;
  
  // 执行持续时间(毫秒)
  durationMs: number;
  
  // 执行状态: 'success'|'failed'|'timeout'
  status: string;
  
  // 尝试次数（重试的情况下）
  attempt: number;
  
  // 错误信息（如果有）
  error?: any;
}
```

## 最佳实践

1. **合理设置超时时间**：根据步骤的预期执行时间设置合理的超时值，避免过长等待或过早超时
2. **使用条件步骤处理错误**：使用条件步骤对前一步骤的结果进行检查，实现自定义错误处理逻辑
3. **记录关键变量**：利用输出映射记录关键变量，便于后续步骤使用和历史记录分析
4. **分析执行历史**：定期分析执行历史，识别可能的性能瓶颈或错误模式
5. **针对不同类型的步骤设置不同的重试策略**：为不同类型的操作（如IO密集型、计算密集型）设置不同的重试参数
6. **启用缓存机制**：对于频繁执行的相同步骤，启用缓存以减少重复计算
7. **使用批处理功能**：对于需要调用相同API的多个操作，使用批处理功能
8. **支持异步执行**：对于可以并行执行的步骤，使用异步执行
9. **为长时间运行的步骤设置合理的超时时间**：为长时间运行的步骤设置合理的超时时间，避免长时间阻塞整个工作流
10. **配置适当的重试策略**：对于可能失败的关键步骤，配置适当的重试策略 

## 相关执行引擎

Mastra Runtimes提供了多种执行引擎，用于不同场景的AI任务处理：

1. **WorkflowExecutor** - 本文档所述的工作流执行引擎，用于按预定步骤顺序执行操作
2. **[NetworkExecutor](../NetworkExecutor.md)** - 智能体网络执行引擎，用于多代理协作和动态路由

根据您的使用场景选择合适的执行引擎：
- 对于需要固定流程和精确控制的场景，使用WorkflowExecutor
- 对于需要智能体协作和动态选择处理者的场景，使用NetworkExecutor
- 在复杂系统中，可以同时使用两者，让网络作为工作流中的一个步骤，或让工作流作为网络中的一个工具

更多信息，请参考[NetworkExecutor文档](../NetworkExecutor.md)。 