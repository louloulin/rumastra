# Mastra Runtime 插件系统

Mastra Runtime 插件系统为运行时提供了强大的扩展能力，使开发者能够动态添加新功能，而无需修改核心代码。本文档介绍插件系统的设计、API和使用方法。

## 目录

1. [设计理念](#设计理念)
2. [核心组件](#核心组件)
3. [创建插件](#创建插件)
4. [注册和使用插件](#注册和使用插件)
5. [Hook 机制](#hook-机制)
6. [命令系统](#命令系统)
7. [配置管理](#配置管理)
8. [示例：日志插件](#示例日志插件)
9. [最佳实践](#最佳实践)

## 设计理念

插件系统采用了以下设计原则：

- **模块化**: 每个插件是独立的功能单元，可以单独开发、测试和部署
- **非侵入式**: 插件通过标准接口与运行时交互，不修改核心代码
- **可扩展性**: 插件可以注册钩子(hooks)和命令，扩展运行时行为
- **可配置**: 插件拥有独立的配置管理，支持灵活定制

## 核心组件

插件系统由以下核心组件组成：

### Plugin 接口

所有插件必须实现的接口，定义了插件的基本结构。

```typescript
interface Plugin {
  // 插件唯一标识
  id: string;
  
  // 插件名称
  name: string;
  
  // 插件版本
  version: string;
  
  // 插件描述 (可选)
  description?: string;
  
  // 初始化方法
  init(context: PluginContext): Promise<void>;
  
  // 卸载方法 (可选)
  uninstall?(): Promise<void>;
}
```

### PluginContext 上下文

插件初始化时获得的上下文对象，提供访问运行时服务的接口。

```typescript
interface PluginContext {
  // 事件总线，用于发布/订阅事件
  eventBus: EventBus;
  
  // 注册钩子函数
  registerHook: <T = any>(hookName: string, callback: (data: T) => Promise<T>) => void;
  
  // 注册命令
  registerCommand: (commandName: string, handler: (args: any) => Promise<any>) => void;
  
  // 获取配置
  getConfig: (key: string) => any;
  
  // 设置配置
  setConfig: (key: string, value: any) => void;
}
```

### PluginSystem 类

管理插件生命周期的核心类，负责注册、初始化和卸载插件。

```typescript
class PluginSystem {
  // 注册插件
  async registerPlugin(plugin: Plugin): Promise<void>;
  
  // 卸载插件
  async uninstallPlugin(pluginId: string): Promise<void>;
  
  // 执行钩子
  async executeHook<T = any>(hookName: string, data: T): Promise<T>;
  
  // 执行命令
  async executeCommand(commandName: string, args: any): Promise<any>;
  
  // 获取所有插件
  getPlugins(): Plugin[];
  
  // 获取指定插件
  getPlugin(pluginId: string): Plugin | undefined;
  
  // 检查插件是否已注册
  hasPlugin(pluginId: string): boolean;
}
```

## 创建插件

创建一个插件需要以下步骤：

1. 实现 `Plugin` 接口
2. 在 `init` 方法中注册钩子或命令
3. 实现插件功能逻辑

### 插件示例

```typescript
import { Plugin, PluginContext } from '@mastra/runtimes';

export class MyPlugin implements Plugin {
  id = 'com.example:my-plugin';
  name = 'My Plugin';
  version = '1.0.0';
  description = '这是一个示例插件';
  
  private context: PluginContext | null = null;
  
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // 注册钩子
    context.registerHook('beforeAgentExecution', async (data) => {
      console.log(`代理即将执行: ${data.agentId}`);
      return data;
    });
    
    // 注册命令
    context.registerCommand('myPlugin.sayHello', async (args) => {
      return { message: `Hello, ${args.name || 'World'}!` };
    });
    
    // 设置默认配置
    if (!context.getConfig('defaultGreeting')) {
      context.setConfig('defaultGreeting', 'Hello');
    }
    
    // 订阅事件
    context.eventBus.subscribe('agent.created', this.onAgentCreated.bind(this));
  }
  
  async uninstall(): Promise<void> {
    if (this.context) {
      // 清理事件订阅
      this.context.eventBus.unsubscribe('agent.created', this.onAgentCreated);
      this.context = null;
    }
  }
  
  private onAgentCreated(data: any): void {
    console.log(`检测到新代理创建: ${data.agent.name}`);
  }
  
  // 插件公共API
  public greet(name: string): string {
    const greeting = this.context?.getConfig('defaultGreeting') || 'Hello';
    return `${greeting}, ${name}!`;
  }
}
```

## 注册和使用插件

要使用插件，需要首先创建 `PluginSystem` 实例，然后注册插件：

```typescript
import { EventBus, PluginSystem } from '@mastra/runtimes';
import { MyPlugin } from './my-plugin';

// 创建插件系统
const eventBus = new EventBus();
const pluginSystem = new PluginSystem(eventBus);

// 创建插件实例
const myPlugin = new MyPlugin();

// 注册插件
await pluginSystem.registerPlugin(myPlugin);

// 执行插件注册的命令
const result = await pluginSystem.executeCommand('myPlugin.sayHello', { name: 'Alice' });
console.log(result.message); // 输出: "Hello, Alice!"

// 获取插件实例并使用其API
const plugin = pluginSystem.getPlugin('com.example:my-plugin') as MyPlugin;
console.log(plugin.greet('Bob')); // 输出: "Hello, Bob!"

// 卸载插件
await pluginSystem.uninstallPlugin('com.example:my-plugin');
```

## Hook 机制

Hook（钩子）是插件系统最强大的特性之一，允许插件在特定操作点注入自定义行为。

### 注册 Hook

插件可以通过 `registerHook` 方法注册钩子：

```typescript
context.registerHook('hookName', async (data) => {
  // 处理数据
  data.modified = true;
  return data;
});
```

### 执行 Hook

运行时可以通过 `executeHook` 方法执行注册的钩子：

```typescript
const initialData = { value: 42 };
const processedData = await pluginSystem.executeHook('hookName', initialData);
```

### 常用钩子点

Mastra Runtime 定义了以下常用钩子点：

- `agent.beforeExecution`: 代理执行前
- `agent.afterExecution`: 代理执行后
- `tool.beforeInvocation`: 工具调用前
- `tool.afterInvocation`: 工具调用后
- `workflow.beforeStep`: 工作流步骤执行前
- `workflow.afterStep`: 工作流步骤执行后
- `resource.beforeValidation`: 资源验证前
- `resource.afterValidation`: 资源验证后

## 命令系统

命令系统允许插件注册可被运行时或其他插件调用的功能。

### 注册命令

插件可以通过 `registerCommand` 方法注册命令：

```typescript
context.registerCommand('plugin.commandName', async (args) => {
  // 处理命令
  return { result: args.value * 2 };
});
```

### 执行命令

运行时可以通过 `executeCommand` 方法执行命令：

```typescript
const result = await pluginSystem.executeCommand('plugin.commandName', { value: 21 });
console.log(result.result); // 输出: 42
```

## 配置管理

插件系统提供了配置管理能力，使插件可以保存和读取配置。

### 设置配置

```typescript
context.setConfig('configKey', 'configValue');
```

### 获取配置

```typescript
const value = context.getConfig('configKey');
```

配置值会在插件卸载时自动清理。

## 示例：日志插件

以下是一个完整的日志插件示例：

```typescript
import { Plugin, PluginContext } from '@mastra/runtimes';

export class LoggerPlugin implements Plugin {
  id = 'mastra:logger';
  name = 'Mastra Logger';
  version = '1.0.0';
  description = '为Mastra Runtime提供统一的日志记录功能';
  
  private context: PluginContext | null = null;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // 从配置获取日志级别
    const configLevel = context.getConfig('logLevel');
    if (configLevel) {
      this.logLevel = configLevel;
    }
    
    // 注册命令
    context.registerCommand('logger.setLevel', this.setLogLevel.bind(this));
    context.registerCommand('logger.getLevel', this.getLogLevel.bind(this));
    
    // 监听资源事件
    context.eventBus.subscribe('Agent.created', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Agent.deleted', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Tool.created', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Tool.deleted', this.logResourceEvent.bind(this));
    
    // 监听错误事件
    context.eventBus.subscribe('*.failed', this.logErrorEvent.bind(this));
    context.eventBus.subscribe('*.error', this.logErrorEvent.bind(this));
    
    this.info('Logger plugin initialized');
  }
  
  // 日志方法
  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, context);
    }
  }
  
  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.log('INFO', message, context);
    }
  }
  
  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, context);
    }
  }
  
  error(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      this.log('ERROR', message, context);
    }
  }
  
  // 其他实现省略...
}
```

## 最佳实践

开发插件时，请遵循以下最佳实践：

1. **唯一ID**: 确保插件ID全局唯一，建议使用反向域名(如com.example:plugin-name)
2. **清理资源**: 在uninstall方法中清理所有资源，如事件订阅、计时器等
3. **版本控制**: 使用语义化版本号(SemVer)，便于依赖管理
4. **命名空间**: 命令和钩子名称使用插件ID前缀，避免冲突
5. **错误处理**: 妥善处理异常，避免影响运行时
6. **性能考虑**: 钩子和命令实现应高效，避免阻塞主线程
7. **文档**: 为插件提供详细文档，说明配置选项、钩子和命令

---

通过插件系统，Mastra Runtime 提供了强大的扩展能力，使开发者能够根据需求定制和增强平台功能。 