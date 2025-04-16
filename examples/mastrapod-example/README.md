# MastraPod API 示例

这个示例展示了 MastraPod 的核心概念及使用方式，同时提供了代码实现和声明式配置两种方法。该示例演示了工具、代理和工作流等概念，并对比了不同实现方式的特点。

## 核心概念

MastraPod 的三个核心概念：

1. **工具 (Tool)** - 执行特定功能的函数，接收参数并返回结果
2. **代理 (Agent)** - 包含工具集合的智能实体，可以调用工具并处理结果
3. **工作流 (Workflow)** - 多个步骤的有序集合，形成完整的处理流程

## 示例内容

本示例包含以下四个部分：

1. **直接调用工具** - 演示如何定义和调用工具函数
2. **代理及其工具调用** - 演示如何创建代理并使用其工具集
3. **工作流执行** - 演示如何定义和执行多步骤工作流
4. **声明式配置加载** - 演示如何从YAML文件加载MastraPod配置

前三部分使用代码实现方式，第四部分使用声明式配置方式。

## 实现方式对比

本示例展示了两种实现方式：

### 代码实现方式

- 直接使用TypeScript/JavaScript代码定义工具、代理和工作流
- 提供更直观的理解和调试体验
- 适合快速原型和学习

### 声明式配置方式

- 使用YAML文件定义资源，符合Kubernetes风格的DSL
- 通过MastraPod API加载和执行配置
- 将配置与代码分离，提高可维护性
- 支持动态加载和更新，无需重新编译代码
- 适合复杂的生产环境部署

## 配置文件最佳实践

为确保声明式配置能正确加载，请遵循以下最佳实践：

1. **必需字段设置** - 确保每个资源都包含必需字段：
   - 所有资源必须有`apiVersion`、`kind`、`metadata`和`spec`
   - 工具资源必须有`id`和`execute`字段
   - 工作流资源必须有`initialStep`字段

2. **多文档处理** - 配置文件支持两种格式：
   - 单文档格式（推荐）：所有资源定义在一个YAML文档中
   - 多文档格式：使用`---`分隔符定义多个资源

3. **命名空间** - 所有资源应指定相同的命名空间以便相互引用

示例中使用的配置采用了多文档格式，每个资源单独定义：

```yaml
# 工具资源
apiVersion: mastra/v1
kind: Tool
metadata:
  name: greeter-tool
  namespace: default
spec:
  id: greeter-tool
  name: "Greeting Tool" 
  description: "一个生成问候语的工具"
  type: function
  execute: |
    function greet(params) {
      const name = params.name || 'World';
      return { greeting: `Hello, ${name}!` };
    }

---
# 更多资源定义...
```

## 常见问题解决

在使用声明式配置时可能会遇到以下问题：

1. **元数据读取错误** (`Cannot read properties of undefined (reading 'metadata')`)
   - 确保每个资源都有正确的`metadata`字段
   - 确保资源对象结构符合MastraPod期望的格式

2. **资源加载失败** (`Tool must have an execute function path`)
   - 工具资源必须包含`execute`字段，而不仅仅是`function`字段

3. **资源引用错误** (`Agent not found` 或 `Resource not found`)
   - 确保所有引用的资源名称和命名空间正确
   - 先加载被引用的资源（如工具），再加载引用它们的资源（如代理）

4. **YAML解析错误** (`expected a single document in the stream, but found more`)
   - 使用`yaml.loadAll`而不是`yaml.load`来处理多文档YAML
   - 或者将多文档YAML合并为单一文档

## 运行示例

要运行此示例，请执行以下命令：

```bash
# 安装依赖
npm install

# 构建并运行示例
npm run dev
```

## 示例输出

示例将输出各个部分的执行结果，包括：

- 工具执行结果（问候工具和日期时间工具）
- 代理执行过程和响应
- 工作流执行过程和最终结果
- 声明式配置加载和执行过程

## 配置文件

本示例包含一个`config.yaml`文件，它使用Kubernetes风格的声明式API定义了工具、代理和工作流。配置文件结构如下：

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: greeting-pod
  namespace: default
spec:
  providers:
    default:
      type: local
  memory:
    type: memory
  resources:
    - apiVersion: mastra/v1
      kind: Tool
      # ... 工具定义
    - apiVersion: mastra/v1
      kind: Agent
      # ... 代理定义
    - apiVersion: mastra/v1
      kind: Workflow
      # ... 工作流定义
```

## 文件结构

```
mastrapod-example/
├── package.json      # 项目配置和依赖
├── tsconfig.json     # TypeScript 配置
├── src/
│   ├── index.ts      # 主示例代码，包含代码实现和声明式加载
│   └── config.yaml   # K8s风格的声明式配置文件
└── README.md         # 本文档
```

## 文档

有关 MastraPod API 的更多信息，请查阅以下文档：

- MastraPod API 参考文档
- 声明式配置指南
- 工具开发指南
- 代理配置指南
- 工作流编排指南 