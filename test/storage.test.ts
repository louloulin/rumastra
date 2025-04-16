import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import { 
  StateStore, 
  InMemoryStateStore, 
  FileSystemStateStore,
  createStateStore
} from '../src/core/storage/store';

// 创建一个测试资源
function createTestResource(name: string, kind: string = 'TestKind', namespace: string = 'default') {
  return {
    apiVersion: 'mastra.ai/v1',
    kind,
    metadata: {
      name,
      namespace
    },
    spec: {
      testProperty: 'test-value'
    }
  };
}

describe('存储层测试', () => {
  describe('InMemoryStateStore', () => {
    let store: InMemoryStateStore;
    
    beforeEach(() => {
      store = new InMemoryStateStore();
    });
    
    it('应该能够保存和获取资源', async () => {
      const resource = createTestResource('test-resource');
      
      // 保存资源
      await store.saveResource(resource);
      
      // 获取资源
      const retrieved = await store.getResource('TestKind', 'default', 'test-resource');
      
      // 验证资源
      expect(retrieved).toEqual(resource);
    });
    
    it('应该能够删除资源', async () => {
      const resource = createTestResource('test-resource');
      
      // 保存资源
      await store.saveResource(resource);
      
      // 删除资源
      const deleted = await store.deleteResource('TestKind', 'default', 'test-resource');
      
      // 验证删除成功
      expect(deleted).toBe(true);
      
      // 验证资源已不存在
      const retrieved = await store.getResource('TestKind', 'default', 'test-resource');
      expect(retrieved).toBeNull();
    });
    
    it('应该返回null当资源不存在时', async () => {
      const retrieved = await store.getResource('NonExistent', 'default', 'non-existent');
      expect(retrieved).toBeNull();
    });
    
    it('应该返回false当删除不存在的资源', async () => {
      const deleted = await store.deleteResource('NonExistent', 'default', 'non-existent');
      expect(deleted).toBe(false);
    });
    
    it('应该能够列出指定类型的资源', async () => {
      // 创建多个资源
      const resource1 = createTestResource('test-1', 'TestKind');
      const resource2 = createTestResource('test-2', 'TestKind');
      const resource3 = createTestResource('test-3', 'OtherKind');
      
      // 保存资源
      await store.saveResource(resource1);
      await store.saveResource(resource2);
      await store.saveResource(resource3);
      
      // 列出TestKind资源
      const testKindResources = await store.listResources('TestKind');
      
      // 验证结果
      expect(testKindResources).toHaveLength(2);
      expect(testKindResources).toContainEqual(resource1);
      expect(testKindResources).toContainEqual(resource2);
      expect(testKindResources).not.toContainEqual(resource3);
    });
    
    it('应该能够列出指定命名空间的资源', async () => {
      // 创建多个资源
      const resource1 = createTestResource('test-1', 'TestKind', 'namespace1');
      const resource2 = createTestResource('test-2', 'TestKind', 'namespace1');
      const resource3 = createTestResource('test-3', 'TestKind', 'namespace2');
      
      // 保存资源
      await store.saveResource(resource1);
      await store.saveResource(resource2);
      await store.saveResource(resource3);
      
      // 列出namespace1中的TestKind资源
      const namespace1Resources = await store.listResources('TestKind', 'namespace1');
      
      // 验证结果
      expect(namespace1Resources).toHaveLength(2);
      expect(namespace1Resources).toContainEqual(resource1);
      expect(namespace1Resources).toContainEqual(resource2);
      expect(namespace1Resources).not.toContainEqual(resource3);
    });
    
    it('应该能够监听资源变化', async () => {
      const resource = createTestResource('test-resource');
      const updateResource = { ...resource, spec: { testProperty: 'updated-value' } };
      
      // 创建监听器
      const handler = vi.fn();
      const subscription = store.watchResources('TestKind', handler);
      
      // 保存资源
      await store.saveResource(resource);
      
      // 更新资源
      await store.saveResource(updateResource);
      
      // 删除资源
      await store.deleteResource('TestKind', 'default', 'test-resource');
      
      // 验证监听器被调用
      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, 'ADDED', resource);
      expect(handler).toHaveBeenNthCalledWith(2, 'MODIFIED', updateResource);
      expect(handler).toHaveBeenNthCalledWith(3, 'DELETED', updateResource);
      
      // 取消订阅
      subscription.unsubscribe();
      
      // 再次保存资源
      await store.saveResource(resource);
      
      // 验证监听器不再被调用
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('FileSystemStateStore', () => {
    let store: FileSystemStateStore;
    let tempDir: string;
    
    beforeEach(async () => {
      // 创建临时目录
      tempDir = path.join(tmpdir(), `mastra-test-${Date.now()}`);
      await fs.ensureDir(tempDir);
      
      // 创建存储
      store = new FileSystemStateStore(tempDir);
    });
    
    afterEach(async () => {
      // 清理临时目录
      await fs.remove(tempDir);
    });
    
    it('应该能够保存和获取资源', async () => {
      const resource = createTestResource('test-resource');
      
      // 保存资源
      await store.saveResource(resource);
      
      // 验证文件已创建
      const filePath = path.join(tempDir, 'testkind', 'default', 'test-resource.json');
      expect(await fs.pathExists(filePath)).toBe(true);
      
      // 获取资源
      const retrieved = await store.getResource('TestKind', 'default', 'test-resource');
      
      // 验证资源
      expect(retrieved).toEqual(resource);
    });
    
    it('应该能够删除资源', async () => {
      const resource = createTestResource('test-resource');
      
      // 保存资源
      await store.saveResource(resource);
      
      // 删除资源
      const deleted = await store.deleteResource('TestKind', 'default', 'test-resource');
      
      // 验证删除成功
      expect(deleted).toBe(true);
      
      // 验证文件已删除
      const filePath = path.join(tempDir, 'testkind', 'default', 'test-resource.json');
      expect(await fs.pathExists(filePath)).toBe(false);
      
      // 验证资源已不存在
      const retrieved = await store.getResource('TestKind', 'default', 'test-resource');
      expect(retrieved).toBeNull();
    });
    
    it('应该返回null当资源不存在时', async () => {
      const retrieved = await store.getResource('NonExistent', 'default', 'non-existent');
      expect(retrieved).toBeNull();
    });
    
    it('应该返回false当删除不存在的资源', async () => {
      const deleted = await store.deleteResource('NonExistent', 'default', 'non-existent');
      expect(deleted).toBe(false);
    });
    
    it('应该能够列出指定类型的资源', async () => {
      // 创建多个资源
      const resource1 = createTestResource('test-1', 'TestKind');
      const resource2 = createTestResource('test-2', 'TestKind');
      const resource3 = createTestResource('test-3', 'OtherKind');
      
      // 保存资源
      await store.saveResource(resource1);
      await store.saveResource(resource2);
      await store.saveResource(resource3);
      
      // 列出TestKind资源
      const testKindResources = await store.listResources('TestKind');
      
      // 验证结果
      expect(testKindResources).toHaveLength(2);
      expect(testKindResources.map(r => r.metadata.name).sort()).toEqual(['test-1', 'test-2']);
    });
    
    it('应该能够列出指定命名空间的资源', async () => {
      // 创建多个资源
      const resource1 = createTestResource('test-1', 'TestKind', 'namespace1');
      const resource2 = createTestResource('test-2', 'TestKind', 'namespace1');
      const resource3 = createTestResource('test-3', 'TestKind', 'namespace2');
      
      // 保存资源
      await store.saveResource(resource1);
      await store.saveResource(resource2);
      await store.saveResource(resource3);
      
      // 列出namespace1中的TestKind资源
      const namespace1Resources = await store.listResources('TestKind', 'namespace1');
      
      // 验证结果
      expect(namespace1Resources).toHaveLength(2);
      expect(namespace1Resources.map(r => r.metadata.name).sort()).toEqual(['test-1', 'test-2']);
    });
    
    it('应该能够监听资源变化', async () => {
      const resource = createTestResource('test-resource');
      const updateResource = { ...resource, spec: { testProperty: 'updated-value' } };
      
      // 创建监听器
      const handler = vi.fn();
      const subscription = store.watchResources('TestKind', handler);
      
      // 监听开始后立即执行一次检查，需要等待执行完成
      await vi.waitFor(() => {
        expect(store['watchTimers'].has('TestKind')).toBe(true);
      });
      
      // 保存资源
      await store.saveResource(resource);
      
      // 等待文件系统检查
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith('ADDED', expect.anything());
        const resource = handler.mock.calls[0][1];
        expect(resource.metadata.name).toBe('test-resource');
      });
      
      // 更新资源
      await store.saveResource(updateResource);
      
      // 等待文件系统检查
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith('MODIFIED', expect.anything());
        const calls = handler.mock.calls;
        const lastCallArgs = calls[calls.length - 1];
        expect(lastCallArgs[1].spec.testProperty).toBe('updated-value');
      });
      
      // 取消订阅
      subscription.unsubscribe();
      
      // 验证定时器已移除
      expect(store['watchTimers'].has('TestKind')).toBe(false);
    });
  });
  
  describe('createStateStore工厂函数', () => {
    it('应该创建InMemoryStateStore', () => {
      const store = createStateStore({ type: 'memory' });
      expect(store).toBeInstanceOf(InMemoryStateStore);
    });
    
    it('应该创建FileSystemStateStore', () => {
      const store = createStateStore({ type: 'filesystem', path: '/tmp' });
      expect(store).toBeInstanceOf(FileSystemStateStore);
    });
    
    it('应该对无效类型抛出错误', () => {
      // @ts-ignore
      expect(() => createStateStore({ type: 'invalid' })).toThrow('Unsupported state store type');
    });
  });
});
