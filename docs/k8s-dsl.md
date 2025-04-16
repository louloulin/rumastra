# Mastra Runtime K8s风格DSL解析器

Mastra Runtime K8s风格DSL解析器提供了一种使用Kubernetes风格声明式配置来定义和管理资源的能力。本文档介绍这个解析器的设计、功能和使用方法。

## 目录

1. [设计理念](#设计理念)
2. [资源定义格式](#资源定义格式)
3. [核心功能](#核心功能)
4. [自定义资源定义(CRD)](#自定义资源定义)
5. [MastraPod配置](#mastrapod配置)
6. [迁移旧格式](#迁移旧格式)
7. [最佳实践](#最佳实践)

## 设计理念

K8s风格DSL解析器遵循以下设计原则：

- **声明式**: 描述资源的期望状态而非操作步骤
- **兼容性**: 遵循Kubernetes资源定义格式和最佳实践
- **可扩展性**: 支持自定义资源类型和验证规则
- **可组合性**: 允许资源之间的引用和组合

## 资源定义格式

Mastra资源使用YAML格式定义，遵循Kubernetes风格的结构：

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
  namespace: default
  labels:
    environment: production
    team: ai-team
spec:
  model:
    provider: openai
    name: gpt-4
  instructions: |
    You are a helpful AI assistant.
    Always respond in a professional manner.
```

### 核心字段

每个资源必须包含以下核心字段：

- **apiVersion**: API版本，如 `mastra.ai/v1`
- **kind**: 资源类型，如 `Agent`, `Tool`, `Workflow` 等
- **metadata**: 资源元数据
  - **name**: 资源名称 (必填)
  - **namespace**: 命名空间 (可选，默认为 `default`)
  - **labels**: 标签 (可选)
  - **annotations**: 注解 (可选)
- **spec**: 资源规格定义，包含特定资源类型的配置

### 内置资源类型

Mastra Runtime支持以下内置资源类型：

- **Agent**: AI智能体定义
- **Tool**: 工具定义
- **Workflow**: 工作流定义
- **Network**: 代理网络定义
- **LLM**: 大型语言模型配置
- **CustomResourceDefinition**: 自定义资源类型定义

## 核心功能

K8s DSL解析器提供以下核心功能：

### YAML解析

将YAML文件或文本内容解析为资源对象：

```typescript
import { K8sDSLParser } from 'rumastra';
import { EventBus } from 'rumastra';

const eventBus = new EventBus();
const parser = new K8sDSLParser(eventBus);

// 解析YAML文本
const yamlContent = `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
spec:
  model:
    provider: openai
    name: gpt-4
`;

const resource = parser.parseContent(yamlContent);
console.log(resource.kind); // 输出: "Agent"
console.log(resource.metadata.name); // 输出: "my-agent"
```

### 文件解析

解析本地YAML文件为资源对象：

```typescript
// 解析文件
const resource = await parser.parseFile('/path/to/agent.yaml');
```

### 资源验证

验证资源结构是否符合预期：

```typescript
// 验证资源
try {
  parser.validateResource(resource);
  console.log('资源有效');
} catch (error) {
  console.error('资源无效:', error.message);
}
```

### 目录扫描

扫描目录中的所有YAML文件并返回资源列表：

```typescript
// 扫描目录
const resources = await parser.scanDirectory('/path/to/resources-dir');
console.log(`发现 ${resources.length} 个资源`);
```

### 资源查询

查询已加载的资源：

```typescript
// 获取所有资源
const allResources = parser.getAllResources();

// 按类型查询
const agents = parser.getResourcesByKind('Agent');

// 按名称查询
const myAgent = parser.getResourceByName('Agent', 'default', 'my-agent');
```

## 自定义资源定义(CRD)

Mastra Runtime支持通过CRD扩展资源类型，与Kubernetes中的CRD概念类似。

### 定义CRD

```yaml
apiVersion: mastra.ai/v1
kind: CustomResourceDefinition
metadata:
  name: datasources.mastra.ai
spec:
  group: mastra.ai
  names:
    kind: DataSource
    plural: datasources
    singular: datasource
  scope: Namespaced
  validation:
    openAPIV3Schema:
      type: object
      properties:
        spec:
          type: object
          properties:
            type:
              type: string
              enum: ['postgresql', 'mysql', 'mongodb', 'redis']
            url:
              type: string
            credentials:
              type: object
              properties:
                username:
                  type: string
                password:
                  type: string
          required: ['type', 'url']
```

### 使用自定义资源

```yaml
apiVersion: mastra.ai/v1
kind: DataSource
metadata:
  name: my-database
  namespace: default
spec:
  type: postgresql
  url: postgresql://localhost:5432/mydb
  credentials:
    username: dbuser
    password: dbpass
```

### 在代码中使用CRD

```typescript
// 解析并注册CRD
const crdYaml = await fs.readFile('/path/to/datasource-crd.yaml', 'utf-8');
const crd = parser.parseContent(crdYaml);
parser.validateResource(crd);

// 解析使用自定义资源
const dataSourceYaml = await fs.readFile('/path/to/my-datasource.yaml', 'utf-8');
const dataSource = parser.parseContent(dataSourceYaml);

// 验证自定义资源
parser.validateResource(dataSource);
```

## MastraPod配置

MastraPod是一种特殊的资源类型，用于定义整个Mastra应用及其包含的资源。

### MastraPod格式

```yaml
kind: MastraPod
version: '1'
metadata:
  name: my-application
config:
  logLevel: info
  storage:
    type: filesystem
    path: ./.mastra-data
resources:
  # 内联资源
  - apiVersion: mastra.ai/v1
    kind: Agent
    metadata:
      name: inline-agent
    spec:
      model:
        provider: openai
        name: gpt-4
  
  # 从文件加载
  - file: path/to/agent.yaml
  
  # 从目录加载
  - directory: path/to/resources/
```

### 解析MastraPod

```typescript
// 解析MastraPod配置
const { config, resources } = await parser.parseMastraPod('/path/to/mastrapod.yaml');

console.log('应用配置:', config);
console.log(`加载了 ${resources.length} 个资源`);
```

## 迁移旧格式

K8s DSL解析器提供了从旧格式配置迁移到Kubernetes风格的功能。

### 旧格式示例

```javascript
{
  "agents": {
    "my-agent": {
      "model": {
        "provider": "openai",
        "name": "gpt-4"
      },
      "instructions": "You are a helpful assistant."
    }
  },
  "tools": {
    "my-tool": {
      "type": "http",
      "url": "https://example.com/api"
    }
  }
}
```

### 转换为K8s风格

```typescript
// 转换旧格式配置
const legacyConfig = JSON.parse(fs.readFileSync('/path/to/legacy-config.json', 'utf-8'));
const k8sResources = parser.convertLegacyConfig(legacyConfig);

// 输出转换后的资源
for (const resource of k8sResources) {
  const yamlContent = yaml.dump(resource);
  const filename = `${resource.kind.toLowerCase()}-${resource.metadata.name}.yaml`;
  fs.writeFileSync(path.join('/path/to/output', filename), yamlContent);
}
```

### 转换结果

```yaml
# agent-my-agent.yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: my-agent
  namespace: default
spec:
  model:
    provider: openai
    name: gpt-4
  instructions: You are a helpful assistant.
```

```yaml
# tool-my-tool.yaml
apiVersion: mastra.ai/v1
kind: Tool
metadata:
  name: my-tool
  namespace: default
spec:
  type: http
  url: https://example.com/api
```

## 最佳实践

使用K8s风格DSL时，建议遵循以下最佳实践：

### 资源组织

1. **使用命名空间**: 使用命名空间隔离不同环境或功能的资源
   ```yaml
   metadata:
     namespace: production
   ```

2. **使用标签**: 为资源添加标签，便于筛选和分组
   ```yaml
   metadata:
     labels:
       environment: production
       team: ai-team
       component: chatbot
   ```

3. **使用注解**: 添加注解记录额外信息
   ```yaml
   metadata:
     annotations:
       description: "生产环境聊天机器人"
       lastModifiedBy: "user@example.com"
   ```

### 文件组织

1. **每个资源一个文件**: 将不同资源放在单独的文件中
   ```
   resources/
     agents/
       chatbot.yaml
       support-agent.yaml
     tools/
       weather-tool.yaml
       calendar-tool.yaml
     workflows/
       customer-support.yaml
   ```

2. **使用有意义的文件名**: 文件名应反映资源内容
   ```
   production-chatbot-agent.yaml
   dev-support-workflow.yaml
   ```

### 资源引用

1. **使用一致的命名**: 保持引用名称一致
   ```yaml
   # 工作流中引用代理
   steps:
     - name: step1
       agent: support-agent  # 确保存在同名Agent资源
   ```

2. **使用完整引用**: 如需引用其他命名空间的资源，使用完整引用
   ```yaml
   agent: other-namespace/agent-name
   ```

### 版本控制

1. **保持apiVersion一致**: 对同类资源使用一致的API版本
   ```yaml
   apiVersion: mastra.ai/v1  # 所有资源使用相同版本
   ```

2. **使用Git版本控制**: 将YAML文件纳入版本控制系统

---

K8s风格DSL解析器使Mastra Runtime具备了强大的声明式配置能力，简化了AI应用的定义和管理。通过遵循Kubernetes的设计理念，用户可以使用熟悉的模式来构建复杂的AI系统。 