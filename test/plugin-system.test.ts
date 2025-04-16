import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/core/eventbus';
import { Plugin, PluginContext, PluginSystem } from '../src/core/plugin-system';

// 创建测试用的插件类
class TestPlugin implements Plugin {
  id = 'test:plugin';
  name = 'Test Plugin';
  version = '1.0.0';
  description = '用于测试的插件';
  
  initCalled = false;
  uninstallCalled = false;
  context: PluginContext | null = null;
  
  async init(context: PluginContext): Promise<void> {
    this.initCalled = true;
    this.context = context;
    
    // 注册Hook
    context.registerHook('test.hook', async (data) => {
      return { ...data, processed: true };
    });
    
    // 注册命令
    context.registerCommand('test.command', async (args) => {
      return { result: args.value * 2 };
    });
  }
  
  async uninstall(): Promise<void> {
    this.uninstallCalled = true;
    this.context = null;
  }
}

describe('插件系统测试', () => {
  let eventBus: EventBus;
  let pluginSystem: PluginSystem;
  let testPlugin: TestPlugin;
  
  beforeEach(() => {
    eventBus = new EventBus();
    pluginSystem = new PluginSystem(eventBus);
    testPlugin = new TestPlugin();
  });
  
  describe('插件注册和管理', () => {
    it('应该能够注册插件', async () => {
      // 注册插件
      await pluginSystem.registerPlugin(testPlugin);
      
      // 验证插件被初始化
      expect(testPlugin.initCalled).toBe(true);
      
      // 验证插件已注册
      expect(pluginSystem.hasPlugin('test:plugin')).toBe(true);
      expect(pluginSystem.getPlugin('test:plugin')).toBe(testPlugin);
    });
    
    it('应该禁止重复注册插件', async () => {
      // 首次注册
      await pluginSystem.registerPlugin(testPlugin);
      
      // 再次注册同一个插件应该失败
      await expect(pluginSystem.registerPlugin(testPlugin)).rejects.toThrow(/already registered/);
    });
    
    it('应该能够卸载插件', async () => {
      // 注册然后卸载
      await pluginSystem.registerPlugin(testPlugin);
      await pluginSystem.uninstallPlugin('test:plugin');
      
      // 验证插件卸载方法被调用
      expect(testPlugin.uninstallCalled).toBe(true);
      
      // 验证插件已被移除
      expect(pluginSystem.hasPlugin('test:plugin')).toBe(false);
      expect(pluginSystem.getPlugin('test:plugin')).toBeUndefined();
    });
    
    it('应该能够获取已注册的插件列表', async () => {
      // 注册插件
      await pluginSystem.registerPlugin(testPlugin);
      
      // 创建第二个插件
      const anotherPlugin: Plugin = {
        id: 'another:plugin',
        name: 'Another Plugin',
        version: '1.0.0',
        async init() {}
      };
      
      // 注册第二个插件
      await pluginSystem.registerPlugin(anotherPlugin);
      
      // 验证插件列表
      const plugins = pluginSystem.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(testPlugin);
      expect(plugins).toContain(anotherPlugin);
    });
  });
  
  describe('Hook和命令机制', () => {
    it('应该能够执行插件注册的hook', async () => {
      // 注册插件
      await pluginSystem.registerPlugin(testPlugin);
      
      // 执行hook
      const result = await pluginSystem['executeHook']('test.hook', { value: 42 });
      
      // 验证数据被处理
      expect(result).toEqual({ value: 42, processed: true });
    });
    
    it('应该能够执行插件注册的命令', async () => {
      // 注册插件
      await pluginSystem.registerPlugin(testPlugin);
      
      // 执行命令
      const result = await pluginSystem['executeCommand']('test.command', { value: 21 });
      
      // 验证命令执行结果
      expect(result).toEqual({ result: 42 });
    });
    
    it('应该处理未注册的命令错误', async () => {
      // 执行未注册的命令
      await expect(pluginSystem['executeCommand']('unknown.command', {}))
        .rejects.toThrow(/not registered/);
    });
    
    it('应该在命令执行失败时发出事件', async () => {
      // 创建一个会失败的插件
      const failingPlugin: Plugin = {
        id: 'failing:plugin',
        name: 'Failing Plugin',
        version: '1.0.0',
        async init(context) {
          context.registerCommand('failing.command', async () => {
            throw new Error('命令执行失败');
          });
        }
      };
      
      // 监听错误事件
      const errorHandler = vi.fn();
      eventBus.subscribe('command.error', errorHandler);
      
      // 注册插件
      await pluginSystem.registerPlugin(failingPlugin);
      
      // 执行会失败的命令
      await expect(pluginSystem['executeCommand']('failing.command', {}))
        .rejects.toThrow('命令执行失败');
      
      // 验证错误事件被发布
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        commandName: 'failing.command',
        error: '命令执行失败'
      }));
    });
  });
  
  describe('配置管理', () => {
    it('应该能够保存和检索插件配置', async () => {
      // 创建一个测试配置的插件
      const configPlugin: Plugin = {
        id: 'config:plugin',
        name: 'Config Plugin',
        version: '1.0.0',
        async init(context) {
          // 设置配置
          context.setConfig('testKey', 'testValue');
          context.setConfig('numericKey', 42);
          
          // 读取配置
          const value1 = context.getConfig('testKey');
          const value2 = context.getConfig('numericKey');
          
          // 发布配置值事件
          context.eventBus.publish('config.values', { value1, value2 });
        }
      };
      
      // 监听配置值事件
      const configHandler = vi.fn();
      eventBus.subscribe('config.values', configHandler);
      
      // 注册插件
      await pluginSystem.registerPlugin(configPlugin);
      
      // 验证配置值被正确设置和读取
      expect(configHandler).toHaveBeenCalledWith({
        value1: 'testValue',
        value2: 42
      });
    });
    
    it('应该在卸载插件时清除配置', async () => {
      // 创建能获取配置的插件
      const configPlugin: Plugin = {
        id: 'config:plugin',
        name: 'Config Plugin',
        version: '1.0.0',
        async init(context) {
          context.setConfig('testKey', 'testValue');
        }
      };
      
      // 注册插件
      await pluginSystem.registerPlugin(configPlugin);
      
      // 验证配置值已设置
      expect(pluginSystem['config'].get('config:plugin.testKey')).toBe('testValue');
      
      // 卸载插件
      await pluginSystem.uninstallPlugin('config:plugin');
      
      // 验证配置值已被清除
      expect(pluginSystem['config'].get('config:plugin.testKey')).toBeUndefined();
    });
  });
});
