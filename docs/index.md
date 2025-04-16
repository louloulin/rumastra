# Mastra Runtimes 综合文档

## 1. 架构概览

Mastra Runtimes 是一套基于 Kubernetes 声明式架构理念设计的 AI 运行时框架，它提供了统一管理工具、代理、工作流和网络的声明式 API。通过控制器模式和事件驱动架构，用户可以声明所需资源的目标状态，让 Mastra 自动协调和管理这些资源。

![架构图](https://mermaid.ink/img/pako:eNp1kk1PwzAMhv-K5QucQGIHLpPGaTeYxKTdkA-tFaYh1Wij3nbi33FWNsYKvdWPn9dO7HQlSsiUKr0hvnLXH4AJtI4IwIMUHjpkiIRoQGW7wnrE1pHO8mA10Z0CUWMrxe5h-3SYPe9XIPPFfP14uHtezed3l3BPSGdI54UfcYVKdWDJw3YJd1jCu-ESFp_7gXxQfv7JdGn4MuN0Zfgy43Rl-DKjxOC1I6ZMXTZnZ9cXfzlN5Y-Zr4wT-cPkizG9VqblRn-RLg1fZpyuDF9mnK4MX2aUkNa2r6QbbHWkrlLtFTFhDCnkMdSCeFLjt1U6-8iE8eHyxE6GwGqjXGxfZVwdNm79YVr9j_bGMTk9Oa5iq2LkNq0bV0L2kVtqsrENhSVUGJ38YJ8GJ2FHXlMD2Z7DJBJ4SsVxIlsKlmtaQGa51YxLTIRNXQd9Y-JrLGfZGw_UQfYsYzwE3F2o6ys8Xw5pPWQ?type=png)

### 1.1 核心组件

- **RuntimeManager**: 资源管理和控制器协调的核心
- **Controllers**: 各类资源控制器
- **Executors**: 执行工作流和网络的引擎
- **EventBus**: 事件驱动通信总线
- **StateStore**: 资源状态管理和持久化

### 1.2 资源类型

- **Tool**: 执行特定功能的函数
- **Agent**: 包含工具集合的智能实体
- **Workflow**: 多步骤处理流程
- **Network**: 智能体网络和协作系统
- **CustomResourceDefinition**: 自定义资源定义

## 2. API 详解

### 2.1 MastraPod API

MastraPod 是运行时框架的主入口，提供了资源管理和执行的核心功能。

```typescript
// 创建实例
const pod = new MastraPod({
  debug: true,                // 开启调试日志
  namespace: 'default',       // 默认命名空间
  providers: {                // 模型提供商配置
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    }
  },
  memory: {                   // 内存存储配置
    type: 'memory',
    ttl: 3600
  }
});

// 事件监听
pod.on('resource:added', (data) => { /* 资源添加事件 */ });
pod.on('resource:updated', (data) => { /* 资源更新事件 */ });
pod.on('resource:deleted', (data) => { /* 资源删除事件 */ });
pod.on('error', (error) => { /* 错误事件 */ });

// 加载资源
await pod.addContent(yamlContent);        // 加载YAML内容
await pod.addFile('/path/to/config.yaml'); // 加载YAML文件

// 资源操作
const tools = pod.getTools();             // 获取所有工具
const agents = pod.getAgents();           // 获取所有代理
const workflows = pod.getWorkflows();     // 获取所有工作流
const networks = pod.getNetworks();       // 获取所有网络

// 执行操作
const toolResult = await pod.callTool('tool-name', { param1: 'value1' });
const workflowResult = await pod.runWorkflow('workflow-name', { input: 'value' });
const networkResult = await pod.runNetwork('network-name', { input: 'value' });
```

### 2.2 资源定义

#### 2.2.1 Tool（工具）

```yaml
apiVersion: mastra/v1
kind: Tool
metadata:
  name: calculator-tool
  namespace: default
spec:
  id: calculator-tool
  name: "Calculator Tool"
  description: "执行基本算术运算"
  type: function
  execute: |
    function calculate(params) {
      const { operation, a, b } = params;
      let result;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) throw new Error('除数不能为零');
          result = a / b;
          break;
        default:
          throw new Error('不支持的操作');
      }
      
      return { result };
    }
```

#### 2.2.2 Agent（代理）

```yaml
apiVersion: mastra/v1
kind: Agent
metadata:
  name: math-agent
  namespace: default
spec:
  id: math-agent
  name: "Math Assistant"
  description: "提供数学计算和解释"
  instructions: "你是一个数学助手，帮助用户解决数学问题和计算。"
  model:
    provider: openai
    name: gpt-4
    parameters:
      temperature: 0.2
      max_tokens: 300
  tools:
    calculator-tool: calculator-tool
  memory:
    enabled: true
    type: memory
    ttl: 3600
```

#### 2.2.3 Workflow（工作流）

```yaml
apiVersion: mastra/v1
kind: Workflow
metadata:
  name: math-problem-solver
  namespace: default
spec:
  id: math-problem-solver
  name: "Math Problem Solver"
  description: "分析并解决数学问题"
  initialStep: understand-problem
  steps:
    - id: understand-problem
      name: "Understand Problem"
      agent: math-agent
      input:
        message: "分析以下数学问题: {{ workflow.input.problem }}"
      next: extract-numbers
    
    - id: extract-numbers
      name: "Extract Numbers"
      agent: math-agent
      input:
        message: "从问题中提取需要计算的数字: {{ step.understand-problem.result }}"
      next: perform-calculation
    
    - id: perform-calculation
      name: "Perform Calculation"
      type: tool
      tool: calculator-tool
      input:
        operation: "{{ step.extract-numbers.result.operation }}"
        a: "{{ step.extract-numbers.result.a }}"
        b: "{{ step.extract-numbers.result.b }}"
      next: explain-result

    - id: explain-result
      name: "Explain Result"
      agent: math-agent
      input:
        message: "解释这个计算结果: {{ step.perform-calculation.result.result }}"
      next: END
```

#### 2.2.4 Network（网络）

```yaml
apiVersion: mastra/v1
kind: Network
metadata:
  name: math-tutor-network
  namespace: default
spec:
  id: math-tutor-network
  name: "Math Tutor Network"
  description: "数学辅导智能体网络"
  instructions: "这是一个数学辅导网络，包含多个专业代理"
  agents:
    - name: algebra-expert
      ref: default.algebra-agent
    - name: geometry-expert
      ref: default.geometry-agent
    - name: calculator
      ref: default.math-agent
  router:
    model:
      provider: openai
      name: gpt-4
    instructions: "根据问题类型决定应该由哪个代理回答"
    maxSteps: 10
  state:
    persistence: true
    ttl: 3600
```

### 2.3 DSL 嵌套支持

Mastra Runtimes 支持复杂的 DSL 嵌套，允许在一个资源定义中嵌入另一个资源定义：

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: math-education-system
  namespace: default
spec:
  description: "数学教育系统"
  providers:
    openai:
      type: openai
  memory:
    type: memory
  
  # 嵌套资源定义
  resources:
    # 嵌套工具定义
    - apiVersion: mastra/v1
      kind: Tool
      metadata:
        name: calculator-tool
        namespace: default
      spec:
        id: calculator-tool
        name: "Calculator Tool"
        description: "执行基本算术运算"
        type: function
        execute: |
          function calculate(params) {
            const { operation, a, b } = params;
            let result;
            
            switch (operation) {
              case 'add':
                result = a + b;
                break;
              case 'subtract':
                result = a - b;
                break;
              case 'multiply':
                result = a * b;
                break;
              case 'divide':
                if (b === 0) throw new Error('除数不能为零');
                result = a / b;
                break;
              default:
                throw new Error('不支持的操作');
            }
            
            return { result };
          }
    
    # 嵌套代理定义
    - apiVersion: mastra/v1
      kind: Agent
      metadata:
        name: math-agent
        namespace: default
      spec:
        id: math-agent
        name: "Math Assistant"
        description: "提供数学计算和解释"
        instructions: "你是一个数学助手，帮助用户解决数学问题和计算。"
        model:
          provider: openai
          name: gpt-4
        tools:
          calculator-tool: calculator-tool
    
    # 嵌套工作流定义
    - apiVersion: mastra/v1
      kind: Workflow
      metadata:
        name: math-problem-solver
        namespace: default
      spec:
        id: math-problem-solver
        name: "Math Problem Solver"
        description: "分析并解决数学问题"
        initialStep: understand-problem
        steps:
          - id: understand-problem
            name: "Understand Problem"
            agent: math-agent
            input:
              message: "分析以下数学问题: {{ workflow.input.problem }}"
            next: perform-calculation
          
          - id: perform-calculation
            name: "Perform Calculation"
            type: tool
            tool: calculator-tool
            input:
              operation: "{{ step.understand-problem.result.operation }}"
              a: "{{ step.understand-problem.result.a }}"
              b: "{{ step.understand-problem.result.b }}"
            next: END
```

## 3. 核心模块

### 3.1 控制器

控制器负责资源的协调和管理，详见 [控制器文档](./controllers/README.md)。

### 3.2 工作流系统

工作流系统负责定义和执行工作流，包括步骤超时和重试、执行历史记录等功能，详见 [工作流文档](./workflow/execution-engine.md)。

### 3.3 存储系统

存储系统负责资源状态的持久化，详见 [存储文档](./storage.md)。

## 4. 直接运行 DSL

Mastra Runtimes 支持直接运行 DSL 而无需手动解析，只需使用以下模式：

```typescript
import { Mastra } from 'kastra';

// 创建 Mastra 实例
const mastra = new Mastra();

// 直接从 YAML 文件运行
const result = await mastra.runFromFile('math-education-system.yaml', {
  problem: '如果小明有5个苹果，小红给了他3个苹果，小明现在有多少个苹果？'
});

// 直接从 YAML 内容运行
const yamlContent = `
apiVersion: mastra/v1
kind: Workflow
metadata:
  name: quick-calculator
  namespace: default
spec:
  id: quick-calculator
  name: "Quick Calculator"
  initialStep: calculate
  steps:
    - id: calculate
      name: "Calculate"
      type: function
      function:
        code: |
          function calculate(input) {
            return { result: input.a + input.b };
          }
      next: END
`;

const result = await mastra.runFromContent(yamlContent, {
  a: 5,
  b: 3
});

console.log(result); // { result: 8 }
```

## 5. YAML 配置导入

Mastra Runtimes 提供了多种方法导入 YAML 配置，以满足不同场景的需求：

### 5.1 基本导入方法

```typescript
import { MastraPod } from 'kastra';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

async function importYamlConfigs() {
  const pod = new MastraPod();
  
  // 从文件导入
  await pod.addFile('./configs/tools.yaml');
  
  // 从字符串导入
  const yamlContent = fs.readFileSync('./configs/agents.yaml', 'utf8');
  await pod.addContent(yamlContent);
  
  // 从远程URL导入
  const response = await fetch('https://example.com/workflows.yaml');
  const remoteYaml = await response.text();
  await pod.addContent(remoteYaml);
  
  // 从多个文件批量导入
  const configFiles = [
    './configs/tools/calculator.yaml',
    './configs/tools/translator.yaml',
    './configs/agents/assistant.yaml'
  ];
  
  for (const file of configFiles) {
    await pod.addFile(file);
  }
}
```

### 5.2 处理多文档 YAML

处理包含多个文档的 YAML 文件：

```typescript
import { MastraPod } from 'kastra';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

async function importMultiDocYaml() {
  const pod = new MastraPod();
  
  // 读取多文档YAML
  const yamlContent = fs.readFileSync('./configs/all-resources.yaml', 'utf8');
  
  // 使用js-yaml解析多文档
  const documents = yaml.loadAll(yamlContent);
  
  // 依次添加每个文档
  for (const doc of documents) {
    await pod.addResource(doc);
  }
  
  // 或者使用高级方法自动处理多文档
  await pod.addMultiDocContent(yamlContent);
}
```

多文档 YAML 示例：

```yaml
# all-resources.yaml
---
apiVersion: mastra/v1
kind: Tool
metadata:
  name: text-summarizer
  namespace: default
spec:
  id: text-summarizer
  name: "Text Summarizer"
  description: "生成文本摘要"
  type: function
  execute: |
    function summarize(params) {
      const { text, maxLength } = params;
      // 实现省略
      return { summary: "这是摘要..." };
    }
---
apiVersion: mastra/v1
kind: Tool
metadata:
  name: image-analyzer
  namespace: default
spec:
  id: image-analyzer
  name: "Image Analyzer"
  description: "分析图像内容"
  type: function
  execute: |
    async function analyze(params) {
      const { imageUrl } = params;
      // 实现省略
      return { objects: ["person", "car"], tags: ["outdoor", "sunny"] };
    }
```

### 5.3 带验证的导入

导入配置时进行验证：

```typescript
import { MastraPod, ResourceSchema } from 'kastra';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';

async function validateAndImport() {
  const pod = new MastraPod();
  const ajv = new Ajv();
  
  // 读取YAML内容
  const yamlContent = fs.readFileSync('./configs/workflow.yaml', 'utf8');
  
  try {
    // 解析YAML
    const resource = yaml.load(yamlContent);
    
    // 根据资源类型获取适当的模式
    const schemaName = resource.kind.toLowerCase();
    const schema = ResourceSchema[schemaName];
    
    // 验证资源
    const validate = ajv.compile(schema);
    const valid = validate(resource);
    
    if (!valid) {
      console.error('验证失败:', validate.errors);
      return;
    }
    
    // 验证通过，添加资源
    await pod.addContent(yamlContent);
    console.log(`成功导入 ${resource.kind}: ${resource.metadata.name}`);
  } catch (error) {
    console.error('导入失败:', error);
  }
}
```

### 5.4 动态配置管理

实现配置的动态加载和热更新：

```typescript
import { MastraPod } from 'kastra';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

class ConfigManager {
  private pod: MastraPod;
  private configDir: string;
  private loadedConfigs: Map<string, string> = new Map();
  
  constructor(configDir: string) {
    this.pod = new MastraPod();
    this.configDir = configDir;
  }
  
  // 初始加载所有配置
  async initialize() {
    const files = await fs.promises.readdir(this.configDir);
    for (const file of files) {
      if (file.endsWith('.yaml')) {
        await this.loadConfig(path.join(this.configDir, file));
      }
    }
    
    // 设置文件监视器
    this.watchConfigChanges();
  }
  
  // 加载配置文件
  private async loadConfig(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);
      
      // 存储配置内容以便比较
      this.loadedConfigs.set(fileName, content);
      
      // 添加到MastraPod
      await this.pod.addContent(content);
      console.log(`加载配置: ${fileName}`);
    } catch (error) {
      console.error(`加载配置失败 ${filePath}:`, error);
    }
  }
  
  // 监视配置变化
  private watchConfigChanges() {
    const watcher = chokidar.watch(this.configDir, {
      persistent: true,
      ignoreInitial: true
    });
    
    watcher.on('add', async (filePath) => {
      if (filePath.endsWith('.yaml')) {
        await this.loadConfig(filePath);
      }
    });
    
    watcher.on('change', async (filePath) => {
      if (filePath.endsWith('.yaml')) {
        const fileName = path.basename(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // 比较内容是否变化
        if (this.loadedConfigs.get(fileName) !== content) {
          console.log(`配置变更: ${fileName}`);
          
          // 删除旧资源
          const oldContent = this.loadedConfigs.get(fileName);
          if (oldContent) {
            const resources = this.extractResourceNames(oldContent);
            for (const { kind, name } of resources) {
              await this.pod.deleteResource(kind, name);
            }
          }
          
          // 加载新配置
          await this.loadConfig(filePath);
        }
      }
    });
    
    watcher.on('unlink', async (filePath) => {
      if (filePath.endsWith('.yaml')) {
        const fileName = path.basename(filePath);
        const content = this.loadedConfigs.get(fileName);
        
        if (content) {
          console.log(`配置删除: ${fileName}`);
          
          // 删除相关资源
          const resources = this.extractResourceNames(content);
          for (const { kind, name } of resources) {
            await this.pod.deleteResource(kind, name);
          }
          
          this.loadedConfigs.delete(fileName);
        }
      }
    });
  }
  
  // 从YAML内容提取资源名称
  private extractResourceNames(content: string) {
    const resources = [];
    try {
      const docs = yaml.loadAll(content);
      for (const doc of docs) {
        if (doc.kind && doc.metadata && doc.metadata.name) {
          resources.push({
            kind: doc.kind,
            name: doc.metadata.name
          });
        }
      }
    } catch (error) {
      console.error('解析YAML失败:', error);
    }
    return resources;
  }
  
  // 获取MastraPod实例
  getPod() {
    return this.pod;
  }
}

// 使用配置管理器
async function main() {
  const configManager = new ConfigManager('./configs');
  await configManager.initialize();
  
  const pod = configManager.getPod();
  
  // 使用已加载的资源
  const tools = pod.getTools();
  console.log(`已加载 ${tools.length} 个工具`);
  
  // 执行工作流
  const result = await pod.runWorkflow('learning-workflow', {
    input: 'Hello world'
  });
  
  console.log('工作流结果:', result);
}
```

### 5.5 导入基于环境的配置

根据不同环境加载不同配置：

```typescript
import { MastraPod } from 'kastra';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

async function loadEnvironmentBasedConfig() {
  const pod = new MastraPod();
  
  // 获取当前环境
  const env = process.env.NODE_ENV || 'development';
  console.log(`当前环境: ${env}`);
  
  // 基础配置目录
  const baseConfigDir = './configs';
  
  // 加载基础配置
  const baseConfigs = await fs.promises.readdir(baseConfigDir);
  for (const file of baseConfigs) {
    if (file.endsWith('.yaml')) {
      await pod.addFile(path.join(baseConfigDir, file));
    }
  }
  
  // 环境特定配置目录
  const envConfigDir = `./configs/${env}`;
  
  // 检查环境配置目录是否存在
  try {
    await fs.promises.access(envConfigDir);
    
    // 加载环境特定配置（会覆盖基础配置中的同名资源）
    const envConfigs = await fs.promises.readdir(envConfigDir);
    for (const file of envConfigs) {
      if (file.endsWith('.yaml')) {
        await pod.addFile(path.join(envConfigDir, file));
      }
    }
  } catch (error) {
    console.log(`没有找到环境特定配置目录: ${envConfigDir}`);
  }
  
  // 打印加载的资源
  console.log('已加载资源:');
  console.log('- 工具:', pod.getTools().map(t => t.metadata.name).join(', '));
  console.log('- 代理:', pod.getAgents().map(a => a.metadata.name).join(', '));
  console.log('- 工作流:', pod.getWorkflows().map(w => w.metadata.name).join(', '));
  
  return pod;
}
```

## 6. 高级特性

### 6.1 模板插值

Mastra Runtimes 支持强大的模板插值系统，允许动态引用数据：

```yaml
input:
  message: "Hello, {{ workflow.input.name }}!"                  # 引用工作流输入
  data: "{{ step.previous-step.result.data }}"                  # 引用上一步骤结果
  combined: "{{ workflow.input.prefix }} {{ agent.name }}"      # 混合引用
  nested: "{{ step.extract.result.user.profile.name }}"         # 嵌套属性引用
  condition: "{{ workflow.input.value > 10 ? 'High' : 'Low' }}" # 条件表达式
```

### 6.2 条件执行

工作流支持条件执行，根据前一步骤结果决定下一步：

```yaml
steps:
  - id: check-value
    name: "Check Value"
    type: function
    function:
      code: |
        function check(input) {
          if (input.value > 10) {
            return { result: 'high', next: 'process-high' };
          } else {
            return { result: 'low', next: 'process-low' };
          }
        }
    next: "{{ step.check-value.result.next }}"
  
  - id: process-high
    name: "Process High Value"
    # ...
  
  - id: process-low
    name: "Process Low Value"
    # ...
```

### 6.3 并行执行

工作流支持步骤并行执行：

```yaml
steps:
  - id: fetch-data
    name: "Fetch Data"
    # ...
    next: [process-user-data, process-order-data]
  
  - id: process-user-data
    name: "Process User Data"
    # ...
    next: merge-results
  
  - id: process-order-data
    name: "Process Order Data"
    # ...
    next: merge-results
  
  - id: merge-results
    name: "Merge Results"
    dependencies: [process-user-data, process-order-data]
    # ...
    next: END
```

### 6.4 状态管理

MastraPod 支持多种状态管理选项：

```yaml
spec:
  memory:
    type: memory           # 内存存储（默认）
    ttl: 3600              # 缓存过期时间（秒）

  # 或者使用 Postgres
  memory:
    type: postgres
    url: "postgresql://user:password@localhost:5432/dbname"
    
  # 或者使用 LibSQL
  memory:
    type: libsql
    url: "libsql://path/to/database.db"
```

## 7. 综合示例

以下是一个综合教育系统示例，展示了 Mastra Runtimes 的强大功能：

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: education-system
  namespace: default
spec:
  description: "综合教育智能系统"
  providers:
    openai:
      type: openai
    anthropic:
      type: anthropic
  memory:
    type: memory
    ttl: 7200
  
  resources:
    # 搜索工具
    - apiVersion: mastra/v1
      kind: Tool
      metadata:
        name: search-tool
        namespace: default
      spec:
        id: search-tool
        name: "Search Tool"
        description: "搜索教育相关信息"
        type: function
        execute: |
          async function search(params) {
            // 模拟搜索功能
            const { query } = params;
            console.log(`Searching for: ${query}`);
            
            // 返回模拟结果
            return {
              results: [
                { title: "关于" + query + "的基础知识", url: "https://example.com/1" },
                { title: query + "进阶学习", url: "https://example.com/2" },
                { title: query + "实践应用", url: "https://example.com/3" }
              ]
            };
          }
    
    # 内容生成工具
    - apiVersion: mastra/v1
      kind: Tool
      metadata:
        name: content-generator
        namespace: default
      spec:
        id: content-generator
        name: "Content Generator"
        description: "生成教育内容"
        type: function
        execute: |
          function generateContent(params) {
            const { topic, level, format } = params;
            
            return {
              content: `这是关于${topic}的${level}级${format}内容。`,
              metadata: {
                topic,
                level,
                format,
                generatedAt: new Date().toISOString()
              }
            };
          }
    
    # 教师代理
    - apiVersion: mastra/v1
      kind: Agent
      metadata:
        name: teacher-agent
        namespace: default
      spec:
        id: teacher-agent
        name: "Teacher Agent"
        description: "提供专业教学和回答问题"
        instructions: "你是一位经验丰富的教师，专长于帮助学生理解复杂概念并提供教学指导。"
        model:
          provider: anthropic
          name: claude-3-opus
          parameters:
            temperature: 0.3
        tools:
          search: search-tool
          content: content-generator
    
    # 学生指导代理
    - apiVersion: mastra/v1
      kind: Agent
      metadata:
        name: student-guide
        namespace: default
      spec:
        id: student-guide
        name: "Student Guide"
        description: "学习指导和规划"
        instructions: "你是一位学习指导专家，帮助学生规划学习路径和提供学习建议。"
        model:
          provider: openai
          name: gpt-4
        tools:
          search: search-tool
    
    # 评估代理
    - apiVersion: mastra/v1
      kind: Agent
      metadata:
        name: assessment-agent
        namespace: default
      spec:
        id: assessment-agent
        name: "Assessment Agent"
        description: "评估学习成果"
        instructions: "你是一位评估专家，帮助评估学习成果并提供建设性反馈。"
        model:
          provider: anthropic
          name: claude-3-sonnet
        tools:
          content: content-generator
    
    # 学习计划工作流
    - apiVersion: mastra/v1
      kind: Workflow
      metadata:
        name: learning-plan-workflow
        namespace: default
      spec:
        id: learning-plan-workflow
        name: "Learning Plan Workflow"
        description: "制定个性化学习计划"
        initialStep: understand-goals
        steps:
          - id: understand-goals
            name: "Understand Goals"
            agent: student-guide
            input:
              message: "分析学生的学习目标: {{ workflow.input.goals }}"
            next: search-resources
          
          - id: search-resources
            name: "Search Resources"
            type: tool
            tool: search-tool
            input:
              query: "{{ step.understand-goals.result.topic }}"
            next: create-plan
          
          - id: create-plan
            name: "Create Learning Plan"
            agent: student-guide
            input:
              message: "根据这些资源创建学习计划: {{ step.search-resources.result.results | json }}"
              goals: "{{ workflow.input.goals }}"
              timeframe: "{{ workflow.input.timeframe }}"
            next: generate-materials
          
          - id: generate-materials
            name: "Generate Learning Materials"
            type: tool
            tool: content-generator
            input:
              topic: "{{ step.understand-goals.result.topic }}"
              level: "{{ step.understand-goals.result.level }}"
              format: "学习指南"
            next: final-review
          
          - id: final-review
            name: "Final Review"
            agent: teacher-agent
            input:
              message: "审核这个学习计划和材料"
              plan: "{{ step.create-plan.result }}"
              materials: "{{ step.generate-materials.result }}"
            next: END
    
    # 教育网络
    - apiVersion: mastra/v1
      kind: Network
      metadata:
        name: education-network
        namespace: default
      spec:
        id: education-network
        name: "Education Network"
        description: "教育智能体网络"
        instructions: "这是一个教育网络，包含多个专业教育代理，协作处理学生的学习需求。"
        agents:
          - name: teacher
            ref: default.teacher-agent
          - name: guide
            ref: default.student-guide
          - name: assessor
            ref: default.assessment-agent
        router:
          model:
            provider: openai
            name: gpt-4
          instructions: "根据学生提问的内容，决定由哪个代理处理。"
          maxSteps: 15
        state:
          persistence: true
          ttl: 86400
```

## 8. 运行上述示例

```typescript
import { Mastra } from 'kastra';
import * as fs from 'fs';

async function main() {
  // 初始化环境变量
  process.env.OPENAI_API_KEY = 'your-openai-key';
  process.env.ANTHROPIC_API_KEY = 'your-anthropic-key';
  
  // 创建 Mastra 实例
  const mastra = new Mastra();
  
  // 从文件加载教育系统
  const config = fs.readFileSync('education-system.yaml', 'utf8');
  
  // 加载系统配置
  await mastra.loadContent(config);
  
  console.log("教育系统已加载");
  
  // 执行学习计划工作流
  const learningPlanResult = await mastra.runWorkflow('learning-plan-workflow', {
    goals: "我想在3个月内学习Python编程，从零基础到能够构建简单的web应用。",
    timeframe: "3个月"
  });
  
  console.log("学习计划已生成:");
  console.log(JSON.stringify(learningPlanResult, null, 2));
  
  // 使用教育网络回答问题
  const networkResult = await mastra.runNetwork('education-network', {
    message: "我在学习循环概念时遇到了困难，能否提供一些易懂的例子？"
  });
  
  console.log("教育网络回答:");
  console.log(networkResult.answer);
}

main().catch(console.error);
```

## 9. 故障排除

### 9.1 常见问题

1. **资源无法加载**:
   - 确保YAML格式正确
   - 检查必要字段 (apiVersion, kind, metadata, spec)
   - 验证资源ID唯一性

2. **工作流执行失败**:
   - 检查步骤依赖是否正确
   - 确保引用变量存在
   - 验证模板语法正确

3. **代理或工具未找到**:
   - 确保命名空间正确
   - 验证资源名称与引用匹配
   - 检查资源加载顺序

### 9.2 调试技巧

1. **开启详细日志**:
   ```typescript
   const pod = new MastraPod({ debug: true });
   ```

2. **监听事件**:
   ```typescript
   pod.on('resource:added', console.log);
   pod.on('error', console.error);
   ```

3. **检查加载的资源**:
   ```typescript
   console.log('Tools:', pod.getTools().map(t => t.metadata.name));
   console.log('Agents:', pod.getAgents().map(a => a.metadata.name));
   console.log('Workflows:', pod.getWorkflows().map(w => w.metadata.name));
   ```

4. **验证YAML**:
   ```typescript
   import * as yaml from 'js-yaml';
   try {
     const parsed = yaml.load(yamlContent);
     console.log('YAML valid:', parsed);
   } catch (error) {
     console.error('YAML invalid:', error.message);
   }
   ```

## 10. 高级开发指南

### 10.1 自定义控制器

```typescript
import { AbstractController, EventBus, RuntimeResource } from 'kastra';

// 定义资源类型
interface CustomResource extends RuntimeResource {
  spec: {
    customField: string;
    // 其他字段
  };
}

// 创建自定义控制器
class CustomController extends AbstractController<CustomResource> {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  async getDesiredState(resource: CustomResource) {
    // 实现目标状态计算逻辑
    return {
      customField: resource.spec.customField,
      // 其他状态
    };
  }

  async getCurrentState(resource: CustomResource) {
    // 实现当前状态获取逻辑
    return {
      // 当前状态
    };
  }

  protected async updateResourceState(resource: CustomResource, desiredState: any, currentState: any) {
    // 实现状态更新逻辑
    console.log(`Updating resource ${resource.metadata.name}`);
    // 更新状态
  }

  protected async cleanupResource(resource: CustomResource) {
    // 实现资源清理逻辑
    console.log(`Cleaning up resource ${resource.metadata.name}`);
    // 清理资源
  }
}

// 注册自定义控制器
const pod = new MastraPod();
pod.registerController('Custom', new CustomController(pod.eventBus));
```

### 10.2 扩展工具执行

```typescript
// 创建自定义工具执行器
class CustomToolExecutor {
  async execute(tool: any, params: any) {
    console.log(`Executing custom tool: ${tool.metadata.name}`);
    
    // 预处理
    const enhancedParams = {
      ...params,
      timestamp: new Date().toISOString()
    };
    
    // 执行原始工具
    const result = await originalExecutor.execute(tool, enhancedParams);
    
    // 后处理
    return {
      ...result,
      executedBy: 'CustomToolExecutor',
      executionTime: new Date().toISOString()
    };
  }
}

// 使用自定义执行器
pod.setToolExecutor(new CustomToolExecutor());
```

### 10.3 自定义模板引擎

```typescript
// 创建自定义模板解析器
class CustomTemplateParser {
  parse(template: string, context: any) {
    // 自定义模板解析逻辑
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
      // 自定义表达式求值
      return this.evaluateExpression(expr, context);
    });
  }
  
  evaluateExpression(expr: string, context: any) {
    // 实现表达式求值
    // ...
    return result;
  }
}

// 注册自定义模板解析器
pod.setTemplateParser(new CustomTemplateParser());
```

## 11. 性能优化

### 11.1 资源管理

- 使用命名空间隔离不同应用的资源
- 及时清理不再使用的资源
- 为频繁访问的资源设置缓存

### 11.2 执行优化

- 并行执行独立工作流步骤
- 使用内存存储提高访问速度
- 为长时间运行的操作设置超时

### 11.3 扩展性考虑

- 使用模块化设计分离关注点
- 实现自定义控制器扩展功能
- 采用事件驱动架构提高响应性

## 12. 最佳实践

1. **资源组织**:
   - 使用命名空间分组资源
   - 给资源添加描述性标签
   - 保持合理的资源粒度

2. **错误处理**:
   - 为每个步骤添加错误处理
   - 使用条件流程处理异常
   - 实现重试机制

3. **安全考虑**:
   - 隔离不同用户的资源
   - 限制工具的执行权限
   - 验证和清理用户输入

4. **测试策略**:
   - 为每个资源类型编写单元测试
   - 创建集成测试验证交互
   - 使用模拟服务测试外部依赖

---

通过这篇综合文档，您应该能够充分理解和利用 Mastra Runtimes 框架的强大功能，构建复杂的声明式 AI 应用。无论是简单工具还是复杂的智能体网络，Mastra 都能提供一致的编程模型和优雅的解决方案。
