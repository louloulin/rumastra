# Mastra Runtime 存储层

存储层是 Mastra Runtime 的核心组件之一，负责资源状态的持久化和管理。目前提供三种存储实现：

## 存储接口

所有存储实现都遵循 `StateStore` 接口，提供统一的资源管理功能：

```typescript
export interface StateStore {
  // 获取单个资源
  getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null>;
  
  // 保存单个资源
  saveResource(resource: RuntimeResource): Promise<void>;
  
  // 删除单个资源
  deleteResource(kind: string, namespace: string, name: string): Promise<boolean>;
  
  // 列出资源
  listResources(kind: string, namespace?: string): Promise<RuntimeResource[]>;
  
  // 监听资源变化
  watchResources(kind: string, handler: (event: 'ADDED' | 'MODIFIED' | 'DELETED', resource: RuntimeResource) => void): { unsubscribe: () => void };
}
```

## 存储实现

### 1. InMemoryStateStore

内存存储实现，适用于临时使用和测试场景。所有数据存储在内存中，不提供持久化。

**优点**：
- 速度快，无IO开销
- 简单易用，无外部依赖

**缺点**：
- 不提供持久化，程序重启后数据丢失
- 不适合生产环境

### 2. FileSystemStateStore

文件系统存储实现，将资源保存为独立的JSON文件，按类型和命名空间组织目录结构。

**优点**：
- 提供持久化存储
- 文件组织结构清晰，便于管理
- 支持文件系统工具查看和编辑

**缺点**：
- IO操作较多，性能略低
- 不支持复杂查询
- 需要定期清理删除的资源文件

### 3. DatabaseStateStore

基于JSON文件的数据库存储实现，提供类似数据库的功能，但不依赖外部数据库系统。

**优点**：
- 提供持久化存储
- 减少磁盘IO，使用内存缓存优化读取性能
- 支持事件通知，便于构建响应式系统
- 轻量级，无外部依赖

**缺点**：
- 不支持复杂查询和过滤
- 不适合高并发写入场景
- 所有数据加载到内存，不适合超大数据集

## 使用方法

使用工厂函数创建合适的存储实例：

```typescript
import { createStateStore } from './store';

// 创建内存存储
const memoryStore = createStateStore({ 
  type: 'memory' 
});

// 创建文件系统存储
const fsStore = createStateStore({ 
  type: 'filesystem', 
  path: '/path/to/storage' 
});

// 创建数据库存储
const dbStore = createStateStore({ 
  type: 'database', 
  path: '/path/to/database.json' 
});
```

## 选择合适的存储实现

- 对于开发和测试环境，推荐使用 `InMemoryStateStore`
- 对于需要直接查看和编辑资源文件的场景，推荐使用 `FileSystemStateStore`
- 对于生产环境和需要更好性能的场景，推荐使用 `DatabaseStateStore`

## 扩展存储层

如需支持其他存储后端（如MongoDB、PostgreSQL等），可以实现 `StateStore` 接口创建新的存储类，并在 `createStateStore` 工厂函数中添加相应的类型处理。 