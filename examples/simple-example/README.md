# Mastra Runtimes 简化 API 示例

这个示例演示了如何使用 `@mastra/runtimes` 包中的简化 API 来加载、解析和处理 Kubernetes 风格的 YAML 资源。

## 简化 API 特点

新的简化 API 提供了更直观的方式来处理 Kubernetes 风格的 YAML 配置文件，主要功能包括：

1. **简单的资源加载**：直接从文件或字符串加载资源，无需额外的步骤
2. **统一的资源管理**：集中管理所有资源，提供简单的接口查询和访问
3. **灵活的资源验证**：支持自定义资源定义验证
4. **直观的错误处理**：提供友好的错误信息

## 使用方法

### 基本使用

```javascript
import { 
  SimpleResourceManager, 
  loadResources, 
  loadAndRegister 
} from '@mastra/runtimes';

// 方法 1: 使用 SimpleResourceManager
const manager = new SimpleResourceManager();
const resources = await manager.loadFile('config.yaml');
await manager.registerResources(resources);

// 方法 2: 使用快捷函数
const resources = await loadResources('config.yaml');

// 方法 3: 一次性加载并注册
const runtimeManager = await loadAndRegister('config.yaml');
```

### 详细功能

`SimpleResourceManager` 类提供以下功能：

#### 资源加载

- `loadFile(filePath)`: 从文件加载资源
- `loadFiles(pattern)`: 从多个文件加载资源（支持 glob 模式）
- `parseYAML(content)`: 解析 YAML 内容

#### 资源管理

- `registerResource(resource)`: 注册单个资源
- `registerResources(resources)`: 注册多个资源
- `loadAndRegister(filePath)`: 从文件加载并注册资源

#### 资源查询

- `getResourcesByKind(kind)`: 获取指定类型的所有资源
- `getResource(kind, name, namespace)`: 获取特定的资源

#### 资源验证

- `validateCustomResource(resource)`: 验证自定义资源
- `getValidationErrors(resource)`: 获取验证错误

## 资源文件结构

```yaml
kind: MastraPod
apiVersion: mastra.ai/v1
metadata:
  name: example
  namespace: default
  
resources:
  - kind: CustomResourceDefinition
    # CRD 定义...
    
  - kind: Tool
    # 工具资源...
    
  - kind: Agent
    # 代理资源...
```

## 运行这个示例

1. 安装依赖：
```bash
npm install @mastra/runtimes
```

2. 运行示例：
```bash
node simple-example.js
```

## 简化 API 与传统 API 的对比

| 功能 | 简化 API | 传统 API |
| --- | --- | --- |
| 资源加载 | `await manager.loadFile(filePath)` | 需要创建解析器并处理事件总线 |
| 注册资源 | `await manager.registerResources(resources)` | 需要逐个添加并处理事件 |
| 获取资源 | `manager.getResource(kind, name)` | 需要从运行时管理器查询 |
| 资源验证 | `manager.validateCustomResource(resource)` | 需要访问 CRD 控制器 |

## 错误处理和资源清理

使用简化 API 时，有几个重要的考虑因素可以确保您的应用程序健壮性：

### 资源清理

当您使用 `SimpleResourceManager` 时，建议在不再需要时进行清理：

```javascript
// 在完成资源处理后
manager = null; // 让垃圾收集器清理资源
```

### 异步错误处理

底层运行时包含异步处理逻辑，在某些情况下可能会产生未捕获的异常。处理这些异常的最佳实践是：

```javascript
// 设置自定义的未捕获异常处理程序
process.on('uncaughtException', (err) => {
  // 只处理与您的应用程序相关的错误
  if (err.message.includes('YourAppSpecificString')) {
    console.error(`应用错误: ${err.message}`);
  }
  // 忽略底层运行时的非关键错误
});
```

### 分离加载和注册步骤

在某些情况下，您可能希望仅加载和验证资源，而不实际注册它们：

```javascript
// 只加载资源
const resources = await loadResources('config.yaml');

// 在生产环境中验证资源
const invalidResources = resources.filter(r => !manager.validateCustomResource(r));
if (invalidResources.length > 0) {
  console.error('发现无效资源，请检查配置');
  invalidResources.forEach(r => {
    console.error(`- ${r.kind}/${r.metadata.name}: ${manager.getValidationErrors(r)}`);
  });
}
```

## 更多示例

查看 `simple-example.js` 文件中的完整示例，了解如何使用简化 API 的各种功能。 