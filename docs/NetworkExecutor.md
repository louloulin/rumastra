# NetworkExecutor：增强的网络执行引擎

`NetworkExecutor` 是 Mastra Runtimes 的核心组件之一，负责执行和协调智能体网络中的各个代理。本文档介绍了网络执行引擎的增强特性，包括动态路由算法、状态共享机制和执行追踪功能。

## 功能概述

增强版的网络执行引擎提供以下核心功能：

1. **动态路由算法** - 支持多种代理选择策略，更智能地进行任务分配
2. **状态共享机制** - 在网络内的代理之间高效共享上下文和状态
3. **执行追踪** - 详细记录执行过程，支持性能分析和问题排查

## 使用方式

### 创建网络执行器

```typescript
import { NetworkExecutor } from 'rumastra';

// 创建网络执行器实例
const executor = new NetworkExecutor(
  networkResource,  // 网络资源定义
  agentsMap,        // 代理实例映射表
  routerAgent       // 路由器代理实例
);
```

### 执行生成请求

```typescript
// 基本生成
const result = await executor.generate('用户输入');

// 带选项的生成
const resultWithOptions = await executor.generate('用户输入', {
  initialState: { context: '初始上下文' },
  maxSteps: 10,
  temperature: 0.7,
  enableTracing: true,        // 启用执行追踪
  routingStrategy: RoutingStrategy.ROUND_ROBIN // 设置路由策略
});
```

### 流式生成

```typescript
// 流式生成
const stream = await executor.stream('用户输入', {
  onFinish: (result) => {
    console.log('流式生成完成', result);
  },
  enableTracing: true,
  routingStrategy: RoutingStrategy.HISTORY_BASED
});
```

## 动态路由策略

### 可用的路由策略

执行引擎支持以下路由策略：

1. **DEFAULT** (`RoutingStrategy.DEFAULT`) - 默认策略，使用路由器代理决定
2. **ROUND_ROBIN** (`RoutingStrategy.ROUND_ROBIN`) - 轮询策略，依次使用每个代理
3. **HISTORY_BASED** (`RoutingStrategy.HISTORY_BASED`) - 基于历史表现的策略，根据代理历史数据选择最佳代理
4. **SEMANTIC_MATCHING** (`RoutingStrategy.SEMANTIC_MATCHING`) - 语义匹配策略，根据输入内容和代理专长进行匹配
5. **CUSTOM** (`RoutingStrategy.CUSTOM`) - 自定义策略，通过自定义处理器实现

```typescript
// 设置路由策略
await executor.generate('用户输入', { 
  routingStrategy: RoutingStrategy.ROUND_ROBIN 
});
```

### 自定义路由策略

可以通过实现 `CustomRoutingHandler` 接口来自定义路由逻辑：

```typescript
// 自定义路由处理器
const customHandler: CustomRoutingHandler = {
  selectNextAgent: async (input, agents, state, history) => {
    // 基于输入长度选择代理的简单示例
    const length = input.length;
    if (length % 3 === 0) return 'agent1';
    if (length % 3 === 1) return 'agent2';
    return 'agent3';
  }
};

// 设置自定义路由处理器
executor.setCustomRoutingHandler(customHandler);

// 使用自定义路由策略
await executor.generate('用户输入', { 
  routingStrategy: RoutingStrategy.CUSTOM 
});
```

### 语义匹配路由策略

语义匹配路由策略(`RoutingStrategy.SEMANTIC_MATCHING`)是一种智能路由方式，它基于用户输入内容和代理专长领域之间的语义匹配度，选择最合适的代理来处理请求。

#### 工作原理

1. **代理特性描述** - 每个代理可以配置以下特性字段：
   - `role`: 代理的角色，如"技术支持"、"客户服务"、"财务顾问"等
   - `description`: 代理的详细描述，提供更多上下文
   - `specialties`: 代理的专长领域，是语义匹配的主要依据

2. **匹配算法** - 系统使用简单但有效的语义匹配算法：
   - 将用户输入和代理描述分词
   - 计算关键词匹配度，包括精确匹配和部分匹配
   - 考虑代理历史表现作为权重因子

#### 使用示例

在网络资源定义中，添加代理角色和专长描述：

```yaml
apiVersion: mastra.ai/v1
kind: Network
metadata:
  name: customer-support
spec:
  agents:
    - name: technical-agent
      ref: default.technical-agent
      role: 技术支持
      description: 解决技术问题和故障排除
      specialties: 硬件问题 软件故障 系统错误 网络连接
      
    - name: billing-agent
      ref: default.billing-agent
      role: 财务顾问
      description: 处理账单、付款和财务问题
      specialties: 账单问题 付款处理 退款 价格咨询
      
    - name: general-agent
      ref: default.general-agent
      role: 客户服务
      description: 提供一般信息和帮助
      specialties: 产品信息 服务咨询 常见问题
  router:
    model:
      provider: openai
      name: gpt-4o
    maxSteps: 5
```

执行时指定使用语义匹配路由策略：

```typescript
const result = await networkExecutor.generate("我的账单有问题，上个月被多收费了", {
  routingStrategy: RoutingStrategy.SEMANTIC_MATCHING
});

// 系统会自动选择billing-agent来处理这个请求，因为输入内容
// 与该代理的专长描述"账单问题"有高度匹配
```

#### 优势

- 无需手动编写复杂的路由逻辑
- 根据请求内容智能选择专业领域代理
- 随着代理表现记录增加，路由决策会越来越智能
- 可以与其他路由策略结合使用

#### 最佳实践

1. 为每个代理提供详细的`specialties`描述，使用关键词清晰表述专长领域
2. 使用`role`和`description`提供更丰富的上下文
3. 在测试阶段收集用户反馈，不断优化代理描述
4. 考虑使用更高级的语义匹配算法(如嵌入向量相似度)进一步提升匹配质量

## 状态管理

### 读取和更新状态

```typescript
// 获取当前网络状态
const state = executor.getState();

// 更新网络状态
executor.updateState({
  key1: 'value1',
  key2: 'value2'
});
```

### 在代理调用中使用状态

当网络内的代理被调用时，可以传递状态数据：

```typescript
// 路由器定义中使用状态
const router = {
  // ...
  execute: async (args) => {
    // 调用代理并传递状态
    const result = await agent.execute({
      message: "处理任务",
      state: { context: "相关上下文" }
    });
    
    // 从结果中获取更新后的状态
    const { response, state } = result;
    
    // 使用状态中的数据
    const contextValue = state.context;
  }
};
```

## 执行追踪

### 启用执行追踪

```typescript
// 启用执行追踪
const result = await executor.generate('用户输入', { 
  enableTracing: true 
});

// 访问追踪信息
const traces = result.traces;
const summary = result.traceSummary;
```

### 追踪记录结构

每个执行追踪记录 (`ExecutionTraceRecord`) 包含以下信息：

```typescript
{
  id: '追踪记录ID',
  step: 1, // 步骤编号
  agentId: 'agent1', // 代理ID
  input: '输入内容',
  output: '输出内容',
  startTime: 1627894350000, // 开始时间戳
  endTime: 1627894351000, // 结束时间戳
  latency: 1000, // 延迟时间(毫秒)
  isRouterCall: false, // 是否路由器调用
  stateChanges: { // 状态变更记录
    key1: 'newValue'
  }
}
```

### 追踪摘要

追踪摘要 (`ExecutionTraceSummary`) 提供执行的统计信息：

```typescript
{
  totalCalls: 5, // 总调用次数
  routerCalls: 1, // 路由器调用次数
  agentCalls: 4, // 代理调用次数
  callsByAgent: { // 每个代理的调用次数
    agent1: 2,
    agent2: 1,
    agent3: 1
  },
  totalLatency: 2500, // 总延迟时间(毫秒)
  averageLatency: 500, // 平均延迟时间(毫秒)
  maxLatency: 1000, // 最大延迟时间(毫秒)
  totalSteps: 5 // 总步骤数
}
```

### 获取执行追踪信息

在网络执行期间，可以使用工具获取当前的执行追踪信息：

```typescript
// 在路由器的工具中获取追踪信息
const traceSummary = await tools['network.getExecutionTrace'].execute({
  summary: true
});

// 或者获取完整的追踪记录
const traceData = await tools['network.getExecutionTrace'].execute();
```

## 实用工具

网络执行引擎提供了多个工具函数，在路由器中可以使用这些工具：

1. **network.getState** - 获取网络状态中的值
2. **network.setState** - 设置网络状态中的值
3. **network.routeTo** - 动态选择下一个要调用的代理
4. **network.getExecutionTrace** - 获取执行追踪信息

## 最佳实践

1. **合理选择路由策略**
   - 对于简单应用，使用默认策略
   - 对于负载均衡场景，考虑轮询策略
   - 对于性能关键场景，使用基于历史的路由
   - 对于专业化场景，使用语义匹配

2. **高效使用状态**
   - 保持状态数据简洁
   - 只传递必要的上下文信息
   - 使用状态来避免重复计算

3. **利用执行追踪**
   - 开发和调试时启用追踪
   - 使用追踪数据优化性能
   - 分析代理调用模式改进网络结构

## 性能考虑

1. 启用执行追踪会带来额外的内存和性能开销，建议在生产环境谨慎使用
2. 选择适当的路由策略可以显著影响网络性能和响应时间
3. 大型状态对象会增加内存占用和序列化成本

## 示例：构建智能客服网络

```typescript
// 创建客服网络
const customerSupportNetwork = {
  apiVersion: "mastra.ai/v1",
  kind: "Network",
  metadata: {
    name: "customer-support"
  },
  spec: {
    instructions: "你是一个客户支持系统，协调多个专家解决客户问题",
    agents: [
      { name: "greeter", ref: "default.greeter-agent" },
      { name: "technical", ref: "default.technical-agent" },
      { name: "billing", ref: "default.billing-agent" }
    ],
    router: {
      model: {
        provider: "openai",
        name: "gpt-4o"
      },
      maxSteps: 10
    }
  }
};

// 创建执行器
const executor = new NetworkExecutor(
  customerSupportNetwork,
  agentsMap,
  routerAgent
);

// 使用语义匹配策略处理客户请求
const response = await executor.generate("我的账单有问题", {
  routingStrategy: RoutingStrategy.SEMANTIC_MATCHING,
  enableTracing: true
});
``` 