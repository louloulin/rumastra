import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { RuntimeResource } from '../../types';
import { StateStore } from './store';

/**
 * DatabaseStateStore 实现了一个基于JSON文件的状态存储，提供持久化的资源状态管理
 * 该实现通过JSON文件存储提供类似数据库的功能，避免了对外部数据库系统的依赖
 * 
 * 主要特性：
 * 1. 持久化存储 - 所有资源状态保存到本地文件，在系统重启后仍然可用
 * 2. 内存缓存 - 使用内存缓存提高读取性能，减少磁盘IO
 * 3. 异步同步 - 定期将内存数据同步到磁盘，减少写入操作对性能的影响
 * 4. 事件通知 - 通过事件机制通知资源变化，便于构建响应式系统
 * 5. 错误恢复 - 能够从文件损坏中自动恢复
 * 6. 轻量级 - 不依赖外部数据库，只使用Node.js内置功能
 * 
 * 适用场景：
 * - 单实例部署环境
 * - 无需复杂查询的资源存储
 * - 需要持久化但不想依赖外部数据库的应用
 * 
 * 限制：
 * - 不支持复杂查询和过滤（仅支持基于kind和namespace的筛选）
 * - 不适合高并发写入场景
 * - 所有数据需要加载到内存，不适合存储超大数据集
 */
export class DatabaseStateStore extends EventEmitter implements StateStore {
  private resources: Map<string, RuntimeResource> = new Map();
  private dbPath: string;
  private initialized = false;
  private lastSync = 0;
  private syncInterval = 1000; // 同步到磁盘的时间间隔（毫秒）

  /**
   * 创建一个新的数据库存储实例
   * @param config 配置对象
   * @param config.path 数据库文件路径，应该是一个JSON文件路径
   */
  constructor(config: { path: string }) {
    super();
    this.dbPath = config.path;
    this.initialize().catch(err => {
      console.error('Error initializing DatabaseStateStore:', err);
    });
  }

  /**
   * 初始化数据库存储
   * - 确保目录存在
   * - 加载已有数据
   * - 如果文件不存在或损坏，创建新的数据库文件
   * @private
   */
  private async initialize(): Promise<void> {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(this.dbPath));
      
      // 检查文件是否存在
      if (await fs.pathExists(this.dbPath)) {
        try {
          const data = await fs.readJson(this.dbPath);
          if (Array.isArray(data)) {
            // 加载资源
            for (const resource of data) {
              if (resource && resource.metadata) {
                const id = this.getResourceId(resource);
                this.resources.set(id, resource);
              }
            }
          }
        } catch (e) {
          // 文件损坏或格式错误，创建新文件
          await fs.writeJson(this.dbPath, [], { spaces: 2 });
        }
      } else {
        // 创建新文件
        await fs.writeJson(this.dbPath, [], { spaces: 2 });
      }
      
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize database store:', err);
      throw err;
    }
  }

  /**
   * 从资源对象生成唯一ID
   * @param resource 资源对象
   * @returns 资源的唯一标识符 (格式: namespace.kind.name)
   * @private
   */
  private getResourceId(resource: RuntimeResource): string {
    const namespace = resource.metadata?.namespace || 'default';
    return `${namespace}.${resource.kind}.${resource.metadata?.name}`;
  }

  /**
   * 确保数据库已初始化
   * 如果未初始化则执行初始化过程
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 将内存中的资源数据同步到磁盘
   * 使用节流机制减少频繁写入，除非强制同步
   * @param force 是否强制同步，忽略时间间隔限制
   * @private
   */
  private async syncToDisk(force = false): Promise<void> {
    const now = Date.now();
    if (force || now - this.lastSync > this.syncInterval) {
      try {
        await fs.writeJson(
          this.dbPath, 
          Array.from(this.resources.values()), 
          { spaces: 2 }
        );
        this.lastSync = now;
      } catch (err) {
        console.error('Error syncing database to disk:', err);
      }
    }
  }

  /**
   * 获取单个资源
   * @param kind 资源类型
   * @param namespace 命名空间
   * @param name 资源名称
   * @returns 资源对象，如果不存在则返回null
   */
  async getResource(kind: string, namespace: string, name: string): Promise<RuntimeResource | null> {
    await this.ensureInitialized();
    const id = `${namespace}.${kind}.${name}`;
    return this.resources.get(id) || null;
  }

  /**
   * 保存资源到存储中
   * 如果资源已存在则更新，否则创建新资源
   * @param resource 要保存的资源对象
   */
  async saveResource(resource: RuntimeResource): Promise<void> {
    await this.ensureInitialized();
    
    const id = this.getResourceId(resource);
    const isNew = !this.resources.has(id);
    
    // 添加或更新资源
    this.resources.set(id, { ...resource });
    
    // 同步到磁盘
    await this.syncToDisk();
    
    // 触发事件
    this.emit('resource', {
      type: isNew ? 'added' : 'modified',
      resource
    });
  }

  /**
   * 从存储中删除资源
   * @param kind 资源类型
   * @param namespace 命名空间
   * @param name 资源名称
   * @returns 是否成功删除资源，如果资源不存在则返回false
   */
  async deleteResource(kind: string, namespace: string, name: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const id = `${namespace}.${kind}.${name}`;
    const resource = this.resources.get(id);
    
    if (!resource) {
      return false;
    }
    
    // 删除资源
    this.resources.delete(id);
    
    // 同步到磁盘
    await this.syncToDisk();
    
    // 触发事件
    this.emit('resource', {
      type: 'deleted',
      resource
    });
    
    return true;
  }

  /**
   * 列出符合条件的资源
   * @param kind 资源类型
   * @param namespace 可选的命名空间过滤
   * @returns 符合条件的资源数组
   */
  async listResources(kind: string, namespace?: string): Promise<RuntimeResource[]> {
    await this.ensureInitialized();
    
    return Array.from(this.resources.values()).filter(resource => {
      if (resource.kind !== kind) {
        return false;
      }
      
      if (namespace && (resource.metadata?.namespace || 'default') !== namespace) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * 监听指定类型资源的变化
   * @param kind 要监听的资源类型
   * @param handler 当资源变化时调用的处理函数
   * @returns 包含unsubscribe方法的对象，用于取消监听
   */
  watchResources(
    kind: string,
    handler: (eventType: "ADDED" | "MODIFIED" | "DELETED", resource: RuntimeResource) => void
  ): { unsubscribe: () => void } {
    const handleEvent = (event: { type: 'added' | 'modified' | 'deleted'; resource: RuntimeResource }) => {
      const { resource } = event;
      
      // Filter by kind
      if (resource.kind !== kind) {
        return;
      }
      
      // Map our event types to the interface's expected event types
      const eventType = event.type === 'added' ? 'ADDED' : 
                         event.type === 'modified' ? 'MODIFIED' : 'DELETED';
      
      handler(eventType, resource);
    };
    
    this.on('resource', handleEvent);
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.off('resource', handleEvent);
      }
    };
  }

  /**
   * 关闭数据库连接，将所有未保存的数据写入磁盘
   * 在应用关闭前调用此方法以确保数据完整性
   */
  async close(): Promise<void> {
    // 强制同步到磁盘
    await this.syncToDisk(true);
    // 清空资源缓存
    this.resources.clear();
    this.initialized = false;
  }
} 