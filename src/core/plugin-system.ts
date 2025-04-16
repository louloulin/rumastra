import { EventBus } from './eventbus';

/**
 * 插件接口
 */
export interface Plugin {
  /**
   * 插件ID，用于唯一标识插件
   */
  id: string;
  
  /**
   * 插件名称
   */
  name: string;
  
  /**
   * 插件版本
   */
  version: string;
  
  /**
   * 插件描述
   */
  description?: string;
  
  /**
   * 初始化插件
   * @param context 插件上下文
   */
  init(context: PluginContext): Promise<void>;
  
  /**
   * 卸载插件
   */
  uninstall?(): Promise<void>;
}

/**
 * 插件上下文
 * 包含插件可以访问的运行时服务
 */
export interface PluginContext {
  /**
   * 事件总线
   */
  eventBus: EventBus;
  
  /**
   * 注册Hook回调
   * @param hookName Hook名称
   * @param callback 回调函数
   */
  registerHook: <T = any>(hookName: string, callback: (data: T) => Promise<T>) => void;
  
  /**
   * 注册命令
   * @param commandName 命令名称
   * @param handler 命令处理函数
   */
  registerCommand: (commandName: string, handler: (args: any) => Promise<any>) => void;
  
  /**
   * 获取配置
   * @param key 配置键
   */
  getConfig: (key: string) => any;
  
  /**
   * 设置配置
   * @param key 配置键
   * @param value 配置值
   */
  setConfig: (key: string, value: any) => void;
}

/**
 * 插件系统
 * 负责插件的加载、初始化和卸载
 */
export class PluginSystem {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<string, Array<(data: any) => Promise<any>>>();
  private commands = new Map<string, (args: any) => Promise<any>>();
  private config = new Map<string, any>();
  
  constructor(private eventBus: EventBus) {}
  
  /**
   * 注册插件
   * @param plugin 插件实例
   */
  async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id ${plugin.id} is already registered`);
    }
    
    // 创建插件上下文
    const context: PluginContext = {
      eventBus: this.eventBus,
      registerHook: (hookName, callback) => this.registerHook(plugin.id, hookName, callback),
      registerCommand: (commandName, handler) => this.registerCommand(plugin.id, commandName, handler),
      getConfig: (key) => this.getPluginConfig(plugin.id, key),
      setConfig: (key, value) => this.setPluginConfig(plugin.id, key, value)
    };
    
    // 初始化插件
    try {
      await plugin.init(context);
      this.plugins.set(plugin.id, plugin);
      
      // 发布插件注册事件
      this.eventBus.publish('plugin.registered', { 
        pluginId: plugin.id,
        name: plugin.name,
        version: plugin.version
      });
    } catch (error) {
      // 发布插件初始化失败事件
      this.eventBus.publish('plugin.initFailed', {
        pluginId: plugin.id,
        error: (error as Error).message
      });
      
      throw error;
    }
  }
  
  /**
   * 卸载插件
   * @param pluginId 插件ID
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin with id ${pluginId} is not registered`);
    }
    
    // 调用插件的卸载方法
    if (plugin.uninstall) {
      await plugin.uninstall();
    }
    
    // 移除插件注册的所有hooks
    for (const [hookName, callbacks] of this.hooks.entries()) {
      this.hooks.set(
        hookName,
        callbacks.filter(callback => (callback as any).pluginId !== pluginId)
      );
    }
    
    // 移除插件注册的所有命令
    for (const [commandName, handler] of this.commands.entries()) {
      if ((handler as any).pluginId === pluginId) {
        this.commands.delete(commandName);
      }
    }
    
    // 移除插件的配置
    for (const key of this.config.keys()) {
      if (key.startsWith(`${pluginId}.`)) {
        this.config.delete(key);
      }
    }
    
    // 移除插件
    this.plugins.delete(pluginId);
    
    // 发布插件卸载事件
    this.eventBus.publish('plugin.uninstalled', { pluginId });
  }
  
  /**
   * 注册Hook回调
   * @param pluginId 插件ID
   * @param hookName Hook名称
   * @param callback 回调函数
   */
  private registerHook<T = any>(
    pluginId: string,
    hookName: string,
    callback: (data: T) => Promise<T>
  ): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    // 为回调添加插件ID标识
    (callback as any).pluginId = pluginId;
    
    this.hooks.get(hookName)!.push(callback);
  }
  
  /**
   * 注册命令处理器
   * @param pluginId 插件ID
   * @param commandName 命令名称
   * @param handler 命令处理函数
   */
  private registerCommand(
    pluginId: string,
    commandName: string,
    handler: (args: any) => Promise<any>
  ): void {
    if (this.commands.has(commandName)) {
      throw new Error(`Command ${commandName} is already registered`);
    }
    
    // 为命令处理器添加插件ID标识
    (handler as any).pluginId = pluginId;
    
    this.commands.set(commandName, handler);
  }
  
  /**
   * 执行Hook
   * @param hookName Hook名称
   * @param data 传入数据
   * @returns 处理后的数据
   */
  async executeHook<T = any>(hookName: string, data: T): Promise<T> {
    if (!this.hooks.has(hookName)) {
      return data;
    }
    
    let result = data;
    
    for (const callback of this.hooks.get(hookName)!) {
      try {
        result = await callback(result);
      } catch (error) {
        this.eventBus.publish('hook.error', {
          hookName,
          error: (error as Error).message,
          pluginId: (callback as any).pluginId
        });
      }
    }
    
    return result;
  }
  
  /**
   * 执行命令
   * @param commandName 命令名称
   * @param args 命令参数
   * @returns 命令执行结果
   */
  async executeCommand(commandName: string, args: any): Promise<any> {
    const handler = this.commands.get(commandName);
    
    if (!handler) {
      throw new Error(`Command ${commandName} is not registered`);
    }
    
    try {
      return await handler(args);
    } catch (error) {
      this.eventBus.publish('command.error', {
        commandName,
        error: (error as Error).message,
        pluginId: (handler as any).pluginId
      });
      
      throw error;
    }
  }
  
  /**
   * 获取插件配置
   * @param pluginId 插件ID
   * @param key 配置键
   * @returns 配置值
   */
  private getPluginConfig(pluginId: string, key: string): any {
    return this.config.get(`${pluginId}.${key}`);
  }
  
  /**
   * 设置插件配置
   * @param pluginId 插件ID
   * @param key 配置键
   * @param value 配置值
   */
  private setPluginConfig(pluginId: string, key: string, value: any): void {
    this.config.set(`${pluginId}.${key}`, value);
  }
  
  /**
   * 获取所有已注册的插件
   * @returns 插件列表
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * 获取指定ID的插件
   * @param pluginId 插件ID
   * @returns 插件实例
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  /**
   * 检查插件是否已注册
   * @param pluginId 插件ID
   * @returns 是否已注册
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
} 