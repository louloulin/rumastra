# MastraPod API参考文档

## 概述

MastraPod API是rumastra的高级接口，它提供了一种简单而强大的方式来加载、管理和执行基于YAML定义的Mastra资源，如代理、工具和工作流。这个API大大简化了与Mastra运行时的交互，让开发者可以专注于构建应用而不是处理底层细节。

## 安装

```bash
npm install rumastra
```

## 快速开始

### 基础示例

```javascript
import { loadFile, run } from 'rumastra';

// 方法1：使用loadFile加载并执行
const pod = await loadFile('./mastrapod.yaml');
const result = await pod.runWorkflow('greeting-workflow', { name: 'World' });
console.log(result);

// 方法2：使用run()函数一步完成
const response = await run({
  file: './mastrapod.yaml',
  workflow: 'greeting-workflow',
  input: { name: 'World' }
});
console.log(response);
```

### 创建应用

```javascript
import { createApp } from 'rumastra';

// 创建一个应用并加载多个资源文件
const app = createApp();
await app
  .addFile('./agents.yaml')
  .addFile('./tools.yaml')
  .addFile('./workflows.yaml');

// 使用应用
const agent = app.getAgent('math-agent');
const response = await app.runAgent(agent, '计算2+2等于多少?');
console.log(response);
```

## API参考

### 核心类

#### MastraPod

`MastraPod`是主要的API入口类，用于管理和执行Mastra资源。

```typescript
class MastraPod extends EventEmitter {
  constructor(options?: MastraPodOptions);
  
  // 静态方法
  static loadFile(filePath: string, options?: MastraPodLoadOptions): Promise<MastraPod>;
  static loadContent(content: string, options?: MastraPodLoadOptions): Promise<MastraPod>;
  static createApp(options?: MastraPodOptions): MastraPod;
  static withDefaults(defaults: Record<string, any>): MastraPod;
  
  // 实例方法
  addFile(filePath: string): Promise<MastraPod>;
  addContent(content: string): Promise<MastraPod>;
  scanDirectory(dirPath: string, pattern?: string): Promise<MastraPod>;
  
  // 资源执行
  runAgent(agentName: string, input: string | Record<string, any>, options?: AgentRunOptions): Promise<AgentResponse>;
  runWorkflow(workflowName: string, input?: Record<string, any>, options?: WorkflowRunOptions): Promise<WorkflowResponse>;
  callTool(toolName: string, params?: Record<string, any>, options?: ToolCallOptions): Promise<ToolResponse>;
  
  // 资源获取
  getResource(kind: string, name: string, namespace?: string): RuntimeResource | undefined;
  getResourcesByKind(kind: string, namespace?: string): RuntimeResource[];
  getAgent(name: string, namespace?: string): Agent | null;
  getAgents(namespace?: string): AgentResource[];
  getWorkflows(namespace?: string): WorkflowResource[];
  getTools(namespace?: string): ToolResource[];
  
  // 结果查询
  getResult(executionId: string): any;
}
```

### 辅助函数

#### loadFile

从文件加载MastraPod。

```typescript
function loadFile(filePath: string, options?: MastraPodLoadOptions): Promise<MastraPod>;
```

#### loadContent

从YAML内容字符串加载MastraPod。

```typescript
function loadContent(content: string, options?: MastraPodLoadOptions): Promise<MastraPod>;
```

#### createApp

创建新的MastraPod应用实例。

```typescript
function createApp(options?: MastraPodOptions): MastraPod;
```

#### run

一步完成加载和执行工作流或代理。

```typescript
function run(options: RunOptions): Promise<WorkflowResponse | AgentResponse>;
```

### 接口定义

#### MastraPodOptions

```typescript
interface MastraPodOptions {
  /**
   * 环境变量映射，用于解析环境变量引用
   */
  env?: Record<string, string>;
}
```

#### MastraPodLoadOptions

```typescript
interface MastraPodLoadOptions extends MastraPodOptions {
  /**
   * 是否验证资源
   */
  validate?: boolean;
}
```

#### AgentRunOptions

```typescript
interface AgentRunOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}
```

#### WorkflowRunOptions

```typescript
interface WorkflowRunOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}
```

#### ToolCallOptions

```typescript
interface ToolCallOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}
```

#### RunOptions

```typescript
interface RunOptions {
  /**
   * 文件路径
   */
  file?: string;
  
  /**
   * YAML内容
   */
  content?: string;
  
  /**
   * 工作流名称
   */
  workflow?: string;
  
  /**
   * 代理名称
   */
  agent?: string;
  
  /**
   * 输入内容
   */
  input?: Record<string, any>;
  
  /**
   * 环境变量
   */
  env?: Record<string, string>;
}
```

## 详细示例

### 加载并运行工作流

```javascript
import { loadFile } from 'rumastra';

async function main() {
  // 加载MastraPod
  const pod = await loadFile('./weather-pod.yaml', {
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      WEATHER_API_KEY: process.env.WEATHER_API_KEY
    }
  });
  
  // 运行工作流
  const result = await pod.runWorkflow('weather-workflow', {
    location: 'Beijing',
    date: 'tomorrow'
  });
  
  console.log('Workflow status:', result.status);
  console.log('Workflow result:', result.result);
}

main().catch(console.error);
```

### 事件监听

```javascript
import { loadFile } from 'rumastra';

async function main() {
  const pod = await loadFile('./pod.yaml');
  
  // 监听工作流步骤完成事件
  pod.on('workflow:step:completed', (data) => {
    console.log(`Step ${data.stepId} completed with result:`, data.output);
  });
  
  // 监听工作流完成事件
  pod.on('workflow:completed', (data) => {
    console.log(`Workflow ${data.workflowName} completed with result:`, data.result);
  });
  
  // 运行工作流
  await pod.runWorkflow('multi-step-workflow', { query: 'How does solar energy work?' });
}

main().catch(console.error);
```

### 创建应用并处理环境变量

```javascript
import { createApp } from 'rumastra';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function main() {
  // 创建应用并配置环境变量
  const app = createApp({
    env: process.env
  });
  
  // 加载多个资源文件
  await app
    .addFile('./resources/agents.yaml')
    .addFile('./resources/tools.yaml')
    .addFile('./resources/workflows.yaml');
  
  // 扫描目录加载更多资源
  await app.scanDirectory('./custom-resources', '**/*.{yaml,yml}');
  
  // 执行代理
  const agentResponse = await app.runAgent('customer-service', {
    message: 'I need help with my order',
    orderId: '12345'
  });
  
  console.log('Agent response:', agentResponse.result);
}

main().catch(console.error);
```

## 最佳实践

1. **使用环境变量**：通过MastraPod的环境变量功能来处理敏感信息，如API密钥。

   ```javascript
   const pod = await loadFile('./pod.yaml', {
     env: {
       OPENAI_API_KEY: process.env.OPENAI_API_KEY
     }
   });
   ```

2. **错误处理**：始终使用try/catch块来处理执行错误。

   ```javascript
   try {
     const result = await pod.runWorkflow('workflow-name', input);
     console.log(result);
   } catch (error) {
     console.error('Workflow execution failed:', error);
     // 处理错误...
   }
   ```

3. **资源重用**：对于长期运行的应用，重用MastraPod实例而不是每次请求都创建新实例。

   ```javascript
   // 创建一个全局的MastraPod实例
   const pod = await loadFile('./pod.yaml');
   
   // 在多个请求中重用它
   app.post('/run-workflow', async (req, res) => {
     try {
       const result = await pod.runWorkflow('workflow-name', req.body);
       res.json(result);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

4. **按需加载资源**：对于大型应用，考虑按需加载资源而不是一次加载所有资源。

   ```javascript
   // 根据用户请求按需加载资源
   async function handleUserRequest(userId, requestType) {
     const app = createApp();
     
     // 只加载必要的资源
     if (requestType === 'customerService') {
       await app.addFile('./resources/customer-service.yaml');
     } else if (requestType === 'techSupport') {
       await app.addFile('./resources/tech-support.yaml');
     }
     
     // 处理请求
     return app.runWorkflow(`${requestType}-workflow`, { userId });
   }
   ```

## 常见问题

### 资源未找到错误

**问题**：运行时出现"资源未找到"错误。

**解决方案**：
- 确保资源文件已正确加载
- 检查资源名称和命名空间是否正确
- 验证资源定义是否有效

```javascript
// 检查资源是否存在
const resource = pod.getResource('Agent', 'agent-name');
if (!resource) {
  console.error('Agent not found, available agents:', pod.getResourcesByKind('Agent'));
}
```

### 执行失败

**问题**：代理或工作流执行失败。

**解决方案**：
- 检查响应中的错误信息
- 确保所有必要的环境变量已设置
- 验证输入格式是否正确

```javascript
try {
  const result = await pod.runAgent('agent-name', input);
} catch (error) {
  console.error('Execution failed:', error);
  // 检查特定错误类型
  if (error.message.includes('API key')) {
    console.error('API密钥问题. 请检查环境变量.');
  }
}
```

### 性能优化

**问题**：在高负载下性能不佳。

**解决方案**：
- 重用MastraPod实例
- 只加载必要的资源
- 考虑使用缓存机制

```javascript
// 使用缓存策略
const podCache = new Map();

async function getPod(podKey) {
  if (!podCache.has(podKey)) {
    const pod = await loadFile(`./pods/${podKey}.yaml`);
    podCache.set(podKey, pod);
  }
  return podCache.get(podKey);
}
``` 