# Mastra Runtime 存储层

Mastra Runtime 存储层为资源状态提供持久化能力，支持多种存储后端。本文档介绍存储层的设计、API和使用方法。

## 目录

1. [设计理念](#设计理念)
2. [核心接口](#核心接口)
3. [内存存储实现](#内存存储实现)
4. [文件系统存储实现](#文件系统存储实现)
5. [资源操作](#资源操作)
6. [状态监听](#状态监听)
7. [自定义存储实现](#自定义存储实现)
8. [最佳实践](#最佳实践)

## 设计理念

存储层的设计基于以下原则：

- **抽象接口**: 通过统一接口隔离存储实现细节
- **可扩展性**: 支持多种存储后端，适应不同部署场景
- **一致性**: 提供一致的操作语义，简化使用方式
- **可观察性**: 支持资源变更监听，便于实现响应式行为

## 核心接口

存储层的核心是 `StateStore` 接口，定义了资源操作的统一方法：

```typescript
interface StateStore {
  /**
   * 获取单个资源
   */
  getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null>;
  
  /**
   * 保存单个资源
   */
  saveResource(resource: RuntimeResource): Promise<void>;
  
  /**
   * 删除单个资源
   */
  deleteResource(kind: string, namespace: string, name: string): Promise<boolean>;
  
  /**
   * 获取所有特定类型的资源
   */
  listResources(kind: string, namespace?: string): Promise<RuntimeResource[]>;
  
  /**
   * 监听资源变化
   */
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void };
}
```

## 内存存储实现

`InMemoryStateStore` 提供基于内存的存储实现，适用于开发、测试和无需持久化的场景。

### 特点

- 资源存储在内存中，重启后数据丢失
- 操作速度快，无I/O延迟
- 支持事件通知

### 使用示例

```typescript
import { InMemoryStateStore } from '@mastra/runtimes';

// 创建内存存储
const store = new InMemoryStateStore();

// 保存资源
await store.saveResource({
  apiVersion: 'mastra.ai/v1',
  kind: 'Agent',
  metadata: {
    name: 'my-agent',
    namespace: 'default'
  },
  spec: {
    // ...agent配置
  }
});

// 获取资源
const agent = await store.getResource('Agent', 'default', 'my-agent');

// 列出资源
const agents = await store.listResources('Agent');

// 监听变化
const subscription = store.watchResources('Agent', (event, resource) => {
  console.log(`Agent ${resource.metadata.name} ${event}`);
});

// 停止监听
subscription.unsubscribe();
```

## 文件系统存储实现

`FileSystemStateStore` 提供基于文件系统的存储实现，适用于需要简单持久化的场景。

### 特点

- 资源保存为JSON文件，可在重启后恢复
- 自动创建目录结构 (按kind和namespace组织)
- 支持文件系统监视，自动检测文件变化

### 使用示例

```typescript
import { FileSystemStateStore } from '@mastra/runtimes';
import path from 'path';

// 创建文件系统存储
const store = new FileSystemStateStore(path.join(process.cwd(), '.mastra-data'));

// 保存资源
await store.saveResource({
  apiVersion: 'mastra.ai/v1',
  kind: 'Agent',
  metadata: {
    name: 'my-agent',
    namespace: 'default'
  },
  spec: {
    // ...agent配置
  }
});

// 获取资源
const agent = await store.getResource('Agent', 'default', 'my-agent');

// 文件路径结构：
// .mastra-data/
//   agent/
//     default/
//       my-agent.json
```

### 文件结构

文件系统存储使用以下目录结构：

```
<basePath>/
  <kind-lowercase>/
    <namespace>/
      <name>.json
```

例如：

```
.mastra-data/
  agent/
    default/
      my-agent.json
    production/
      prod-agent.json
  tool/
    default/
      my-tool.json
```

## 资源操作

存储层提供以下核心操作：

### 保存资源

保存或更新资源。如果资源已存在，会被覆盖。

```typescript
// 创建新资源
await store.saveResource(newResource);

// 更新现有资源
const resource = await store.getResource('Agent', 'default', 'my-agent');
if (resource) {
  resource.spec.instructions = '更新的指令';
  await store.saveResource(resource);
}
```

### 获取资源

获取单个资源。如果资源不存在，返回 `null`。

```typescript
const resource = await store.getResource('Agent', 'default', 'my-agent');
if (resource) {
  // 资源存在
  console.log(resource.spec);
} else {
  // 资源不存在
  console.log('Resource not found');
}
```

### 删除资源

删除单个资源。返回是否成功删除。

```typescript
const deleted = await store.deleteResource('Agent', 'default', 'my-agent');
if (deleted) {
  console.log('Resource deleted');
} else {
  console.log('Resource not found or deletion failed');
}
```

### 列出资源

列出特定类型的资源，可选按命名空间筛选。

```typescript
// 列出所有Agent
const allAgents = await store.listResources('Agent');

// 列出特定命名空间的Agent
const defaultAgents = await store.listResources('Agent', 'default');
```

## 状态监听

存储层支持资源变更监听，便于实现响应式行为。

### 监听事件类型

- `ADDED`: 新增资源
- `MODIFIED`: 修改资源
- `DELETED`: 删除资源

### 使用示例

```typescript
// 监听Agent变化
const subscription = store.watchResources('Agent', (event, resource) => {
  switch (event) {
    case 'ADDED':
      console.log(`新增Agent: ${resource.metadata.name}`);
      break;
    case 'MODIFIED':
      console.log(`修改Agent: ${resource.metadata.name}`);
      break;
    case 'DELETED':
      console.log(`删除Agent: ${resource.metadata.name}`);
      break;
  }
});

// 使用完后取消订阅
subscription.unsubscribe();
```

### 自动监听

在 `FileSystemStateStore` 中，监听会自动检测文件系统变化，即使资源由外部进程修改也能触发事件。

## 自定义存储实现

你可以实现自己的存储后端，只需实现 `StateStore` 接口：

```typescript
import { StateStore, RuntimeResource } from '@mastra/runtimes';

export class MyCustomStore implements StateStore {
  async getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null> {
    // 实现资源获取逻辑
  }
  
  async saveResource(resource: RuntimeResource): Promise<void> {
    // 实现资源保存逻辑
  }
  
  async deleteResource(kind: string, namespace: string, name: string): Promise<boolean> {
    // 实现资源删除逻辑
  }
  
  async listResources(kind: string, namespace?: string): Promise<RuntimeResource[]> {
    // 实现资源列表逻辑
  }
  
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void } {
    // 实现资源监听逻辑
  }
}
```

### 常见存储后端实现

Mastra Runtime 支持以下存储后端：

- `InMemoryStateStore`: 内存存储 (内置)
- `FileSystemStateStore`: 文件系统存储 (内置)
- `PrismaStateStore`: Prisma 数据库存储 (需另行安装)
- `LibSQLStateStore`: LibSQL/SQLite 存储 (需另行安装)
- `RedisStateStore`: Redis 存储 (需另行安装)

## 工厂函数

使用工厂函数可简化存储创建：

```typescript
import { createStateStore } from '@mastra/runtimes';

// 创建内存存储
const memoryStore = createStateStore({ type: 'memory' });

// 创建文件系统存储
const fileStore = createStateStore({ 
  type: 'filesystem', 
  path: '/path/to/data' 
});
```

## 最佳实践

1. **选择合适的存储**: 根据应用需求选择适合的存储实现
   - 开发/测试: 使用 `InMemoryStateStore`
   - 简单应用: 使用 `FileSystemStateStore`
   - 生产环境: 使用数据库存储如 `PrismaStateStore`

2. **错误处理**: 所有存储操作都可能失败，确保适当处理异常

3. **资源版本**: 考虑在资源中加入版本字段，避免并发修改冲突

4. **资源缓存**: 对频繁访问的资源考虑实现缓存层

5. **合理组织命名空间**: 使用命名空间隔离不同环境或应用的资源

6. **性能考量**:
   - 内存存储: 适合资源数量较少的场景
   - 文件系统存储: 适合资源变更不频繁的场景
   - 数据库存储: 适合大量资源和高并发场景

---

存储层作为Mastra Runtime的关键组件，提供了灵活的资源持久化能力，支持从简单开发到复杂生产场景的各类需求。 