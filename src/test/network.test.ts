import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkState } from '../core/network/state';
import { InMemoryNetworkStateStore } from '../core/network/store';
import { EventBus } from '../core/eventbus';
import { NetworkController } from '../core/network/controller';
import { createNetworkResource, NetworkResource } from '../types';

describe('Network Functionality', () => {
  // 测试NetworkState
  describe('NetworkState', () => {
    let state: NetworkState;

    beforeEach(() => {
      state = new NetworkState();
    });

    it('should store and retrieve values', () => {
      state.set('testKey', 'testValue');
      expect(state.get('testKey')).toBe('testValue');
    });

    it('should check if key exists', () => {
      state.set('testKey', 'testValue');
      expect(state.has('testKey')).toBe(true);
      expect(state.has('nonExistentKey')).toBe(false);
    });

    it('should delete keys', () => {
      state.set('testKey', 'testValue');
      expect(state.has('testKey')).toBe(true);
      
      state.delete('testKey');
      expect(state.has('testKey')).toBe(false);
    });

    it('should update multiple values', () => {
      state.update({
        key1: 'value1',
        key2: 'value2'
      });
      
      expect(state.get('key1')).toBe('value1');
      expect(state.get('key2')).toBe('value2');
    });

    it('should convert to object', () => {
      state.set('key1', 'value1');
      state.set('key2', { nested: 'value' });
      
      const obj = state.toObject();
      
      expect(obj).toEqual({
        key1: 'value1',
        key2: { nested: 'value' }
      });
    });

    it('should clone state', () => {
      state.set('key1', 'value1');
      
      const cloned = state.clone();
      cloned.set('key2', 'value2');
      
      expect(state.has('key2')).toBe(false);
      expect(cloned.get('key1')).toBe('value1');
      expect(cloned.get('key2')).toBe('value2');
    });
  });

  // 测试NetworkStateStore
  describe('InMemoryNetworkStateStore', () => {
    let store: InMemoryNetworkStateStore;

    beforeEach(() => {
      store = new InMemoryNetworkStateStore();
    });

    it('should store and retrieve network state', async () => {
      await store.updateNetworkState('network1', { key1: 'value1' });
      const state = await store.getNetworkState('network1');
      
      expect(state).toEqual({ key1: 'value1' });
    });

    it('should set and get individual values', async () => {
      await store.setValue('network1', 'key1', 'value1');
      const value = await store.getValue('network1', 'key1');
      
      expect(value).toBe('value1');
    });

    it('should update multiple values', async () => {
      await store.updateValues('network1', {
        key1: 'value1',
        key2: 'value2'
      });
      
      const state = await store.getNetworkState('network1');
      
      expect(state).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should delete network state', async () => {
      await store.updateNetworkState('network1', { key1: 'value1' });
      await store.deleteNetworkState('network1');
      
      const state = await store.getNetworkState('network1');
      expect(state).toEqual({});
    });

    it('should watch for state changes', async () => {
      const changes: any[] = [];
      
      const subscription = store.watchState('network1', (state) => {
        changes.push({ ...state });
      });
      
      // 初始状态
      expect(changes.length).toBe(1);
      expect(changes[0]).toEqual({});
      
      // 更新状态
      await store.setValue('network1', 'key1', 'value1');
      expect(changes.length).toBe(2);
      expect(changes[1]).toEqual({ key1: 'value1' });
      
      // 再次更新
      await store.updateValues('network1', { key2: 'value2' });
      expect(changes.length).toBe(3);
      expect(changes[2]).toEqual({ key1: 'value1', key2: 'value2' });
      
      // 取消订阅
      subscription.unsubscribe();
      
      // 更新应该不再触发
      await store.setValue('network1', 'key3', 'value3');
      expect(changes.length).toBe(3);
    });
  });

  // 测试Network资源创建
  describe('Network Resource Creation', () => {
    it('should create a valid network resource', () => {
      const networkResource = createNetworkResource('test-network', {
        instructions: 'Test network instructions',
        agents: [
          { name: 'agent1', ref: 'default.agent1' },
          { name: 'agent2', ref: 'default.agent2' }
        ],
        router: {
          model: {
            provider: 'openai',
            name: 'gpt-4o'
          },
          maxSteps: 10
        }
      });
      
      // 验证基础字段
      expect(networkResource.apiVersion).toBe('mastra.ai/v1');
      expect(networkResource.kind).toBe('Network');
      expect(networkResource.metadata.name).toBe('test-network');
      
      // 验证规范字段
      expect(networkResource.spec.instructions).toBe('Test network instructions');
      expect(networkResource.spec.agents.length).toBe(2);
      expect(networkResource.spec.router.model.provider).toBe('openai');
      expect(networkResource.spec.router.maxSteps).toBe(10);
    });
  });

  // 测试NetworkController (模拟实现)
  describe('NetworkController', () => {
    let eventBus: EventBus;
    let stateStore: InMemoryNetworkStateStore;
    let controller: NetworkController;
    let networkResource: NetworkResource;
    
    beforeEach(() => {
      eventBus = new EventBus();
      stateStore = new InMemoryNetworkStateStore();
      controller = new NetworkController(eventBus, stateStore);
      
      // 创建测试网络资源
      networkResource = createNetworkResource('test-network', {
        instructions: 'Test network instructions',
        agents: [
          { name: 'agent1', ref: 'default.agent1' },
          { name: 'agent2', ref: 'default.agent2' }
        ],
        router: {
          model: {
            provider: 'openai',
            name: 'gpt-4o'
          },
          maxSteps: 10
        }
      });
    });

    it('should reconcile network resource', async () => {
      // 监听reconciled事件
      let reconciledEvent: any = null;
      eventBus.subscribe('network.reconciled', (event) => {
        reconciledEvent = event;
      });
      
      // 调用协调方法
      await controller.reconcile(networkResource);
      
      // 验证事件发布
      expect(reconciledEvent).not.toBeNull();
      expect(reconciledEvent.resource).toBe(networkResource);
      
      // 验证状态已更新
      const state = await stateStore.getNetworkState('default.test-network');
      expect(state).not.toEqual({});
      
      // 验证资源状态已更新
      expect(networkResource.status).not.toBeUndefined();
      expect(networkResource.status?.phase).toBe('Running');
    });

    it('should clean up resources on deletion', async () => {
      // 首先协调以创建状态
      await controller.reconcile(networkResource);
      
      // 验证状态存在
      let state = await stateStore.getNetworkState('default.test-network');
      expect(state).not.toEqual({});
      
      // 监听cleaned事件
      let cleanedEvent: any = null;
      eventBus.subscribe('network.cleaned', (event) => {
        cleanedEvent = event;
      });
      
      // 调用删除处理程序
      await controller['handleResourceDeleted'](networkResource);
      
      // 验证事件发布
      expect(cleanedEvent).not.toBeNull();
      expect(cleanedEvent.resource).toBe(networkResource);
      
      // 验证状态已删除
      state = await stateStore.getNetworkState('default.test-network');
      expect(state).toEqual({});
    });
  });
}); 