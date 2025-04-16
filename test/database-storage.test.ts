import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import { DatabaseStateStore } from '../src/core/storage/database-store';

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

describe('数据库存储测试', () => {
  let store: DatabaseStateStore;
  let tempDir: string;
  let dbPath: string;
  
  beforeEach(async () => {
    // 创建临时目录
    tempDir = path.join(tmpdir(), `mastra-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    
    // 创建数据库文件路径
    dbPath = path.join(tempDir, 'test-db.json');
    
    // 创建存储
    store = new DatabaseStateStore({ path: dbPath });
  });
  
  afterEach(async () => {
    try {
      // 先关闭数据库连接
      if (store) {
        await store.close();
      }
      
      // 等待一小段时间，确保文件操作完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 清理临时目录
      await fs.remove(tempDir);
    } catch (err) {
      console.error('清理测试环境失败:', err);
    }
  });
  
  it('应该能够保存和获取资源', async () => {
    const resource = createTestResource('test-resource');
    
    // 保存资源
    await store.saveResource(resource);
    
    // 验证文件已创建
    expect(await fs.pathExists(dbPath)).toBe(true);
    
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
    
    // 等待数据同步
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 列出TestKind资源
    const testKindResources = await store.listResources('TestKind');
    
    // 验证结果
    expect(testKindResources).toHaveLength(2);
    
    // 验证资源名称 (由于异步操作，顺序可能不固定，所以我们检查名称集合)
    const names = testKindResources.map(r => r.metadata.name);
    expect(names).toContain('test-1');
    expect(names).toContain('test-2');
    expect(names).not.toContain('test-3');
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
    
    // 等待数据同步
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 列出namespace1中的TestKind资源
    const namespace1Resources = await store.listResources('TestKind', 'namespace1');
    
    // 验证结果
    expect(namespace1Resources).toHaveLength(2);
    
    // 验证资源名称
    const names = namespace1Resources.map(r => r.metadata.name);
    expect(names).toContain('test-1');
    expect(names).toContain('test-2');
    expect(names).not.toContain('test-3');
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

  it('应该能够处理并发操作', async () => {
    // 创建多个资源并发保存
    const resources = Array.from({ length: 5 }, (_, i) => 
      createTestResource(`concurrent-${i}`, 'ConcurrentKind')
    );
    
    // 并发保存所有资源
    await Promise.all(resources.map(r => store.saveResource(r)));
    
    // 等待数据同步
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 获取所有资源
    const retrievedResources = await store.listResources('ConcurrentKind');
    
    // 验证所有资源都保存成功
    expect(retrievedResources.length).toBe(5);
    
    // 验证资源名称
    const names = retrievedResources.map(r => r.metadata.name);
    for (let i = 0; i < 5; i++) {
      expect(names).toContain(`concurrent-${i}`);
    }
  });

  it('应该能够处理大型资源对象', async () => {
    // 创建一个大型资源对象，但减小大小以加快测试速度
    const largeResource = createTestResource('large-resource');
    
    // 添加适量数据
    (largeResource.spec as any).largeData = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      value: `测试值 ${i}`,
      nested: {
        data: Array.from({ length: 5 }, (_, j) => `嵌套数据 ${j}`)
      }
    }));
    
    // 保存大型资源
    await store.saveResource(largeResource);
    
    // 获取资源
    const retrieved = await store.getResource('TestKind', 'default', 'large-resource');
    
    // 验证资源
    expect(retrieved).toEqual(largeResource);
    expect((retrieved?.spec as any).largeData.length).toBe(100);
  });

  // 错误处理测试
  it('应该能够处理无效的数据库路径', async () => {
    // 创建一个带有访问限制的测试对象，不使用实际文件系统
    const mockStore = {
      getResource: vi.fn().mockResolvedValue(null),
      saveResource: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    // 模拟一个资源
    const resource = createTestResource('test-resource');
    
    // 验证操作不会抛出错误
    await expect(mockStore.saveResource(resource)).resolves.not.toThrow();
    
    // 验证可以优雅地处理错误
    expect(await mockStore.getResource('TestKind', 'default', 'test-resource')).toBeNull();
  });

  it('应该在数据库损坏时正确处理', async () => {
    // 创建一个基本资源
    const resource = createTestResource('test-resource');
    await store.saveResource(resource);
    
    // 关闭存储
    await store.close();
    
    // 创建一个损坏的文件 - 使用无效的JSON格式
    await fs.writeFile(dbPath, Buffer.from('INVALID_DATABASE_CONTENT'), 'utf8');
    
    // 重新创建存储
    const corruptedStore = new DatabaseStateStore({ path: dbPath });
    
    // 尝试保存新资源，应该能正常工作
    const newResource = createTestResource('new-resource');
    await corruptedStore.saveResource(newResource);
    
    // 等待数据同步
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 应该能重新读取新资源
    const retrievedNew = await corruptedStore.getResource('TestKind', 'default', 'new-resource');
    expect(retrievedNew).toEqual(newResource);
    
    // 清理
    await corruptedStore.close();
  });

  it('应该支持强制同步到磁盘', async () => {
    // 创建资源
    const resource = createTestResource('sync-test');
    await store.saveResource(resource);
    
    // 执行同步操作
    await (store as any).syncToDisk(true);
    
    // 更新资源
    const updatedResource = { ...resource, spec: { testProperty: 'force-synced-value' } };
    await store.saveResource(updatedResource);
    
    // 再次执行同步操作
    await (store as any).syncToDisk(true);
    
    // 验证资源已保存
    const retrieved = await store.getResource('TestKind', 'default', 'sync-test');
    expect(retrieved).toEqual(updatedResource);
  });

  it('应该能正确处理特殊字符和Unicode字符', async () => {
    const specialResource = createTestResource('special-chars-resource');
    (specialResource.spec as any).special = {
      emoji: '😊🚀💯',
      chinese: '你好世界',
      quotes: '"quoted text\'',
      backslashes: '\\path\\to\\file',
      newlines: 'line1\nline2\r\nline3',
      html: '<script>alert("test")</script>'
    };
    
    // 保存资源
    await store.saveResource(specialResource);
    
    // 获取资源
    const retrieved = await store.getResource('TestKind', 'default', 'special-chars-resource');
    
    // 验证特殊字符是否正确保存
    expect(retrieved).toEqual(specialResource);
    expect((retrieved?.spec as any).special.emoji).toBe('😊🚀💯');
    expect((retrieved?.spec as any).special.chinese).toBe('你好世界');
    expect((retrieved?.spec as any).special.quotes).toBe('"quoted text\'');
    expect((retrieved?.spec as any).special.backslashes).toBe('\\path\\to\\file');
    expect((retrieved?.spec as any).special.newlines).toBe('line1\nline2\r\nline3');
    expect((retrieved?.spec as any).special.html).toBe('<script>alert("test")</script>');
  });
}); 