/**
 * 缓存项接口
 */
export interface CacheItem<T = any> {
  /** 键 */
  key: string;
  
  /** 值 */
  value: T;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 最后访问时间 */
  lastAccessedAt: number;
  
  /** 到期时间 */
  expiresAt?: number;
  
  /** 命中次数 */
  hits: number;
  
  /** 标签集 */
  tags?: string[];
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 默认缓存项生存时间（毫秒）*/
  defaultTTL?: number;
  
  /** 最大缓存项数量 */
  maxItems?: number;
  
  /** 清理间隔（毫秒）*/
  cleanupInterval?: number;
  
  /** 是否启用计数统计 */
  enableStats?: boolean;
  
  /** 是否自动分析命中率 */
  autoAnalyze?: boolean;
  
  /** 是否在缓存满时使用LRU（最近最少使用）替换策略 */
  useLRUReplacement?: boolean;
  
  /** 是否允许压缩缓存项 */
  enableCompression?: boolean;
}

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  /** 缓存项总数 */
  totalItems: number;
  
  /** 总命中次数 */
  totalHits: number;
  
  /** 总未命中次数 */
  totalMisses: number;
  
  /** 命中率 */
  hitRate: number;
  
  /** 已用内存（字节，估计值）*/
  memoryUsage: number;
  
  /** 最老的缓存项年龄（毫秒） */
  oldestItemAge?: number;
  
  /** 最新的缓存项年龄（毫秒） */
  newestItemAge?: number;
  
  /** 每个标签的项目数量 */
  tagCounts?: Record<string, number>;
  
  /** 缓存创建时间 */
  createdAt?: number;
  
  /** 最后写入时间 */
  lastWriteAt?: number;
  
  /** 最后清理时间 */
  lastCleanupAt?: number;
  
  /** 缓存驱逐项数量 */
  evictionCount?: number;
}

/**
 * 缓存键生成选项
 */
export interface CacheKeyOptions {
  /** 前缀 */
  prefix?: string;
  
  /** 命名空间 */
  namespace?: string;
  
  /** 分区 */
  partition?: string;
  
  /** 是否包含时间戳 */
  includeTimestamp?: boolean;
}

/**
 * 高性能缓存管理器，用于存储计算结果
 */
export class CacheManager {
  private cache: Map<string, CacheItem> = new Map();
  private config: CacheConfig;
  private evictionCount: number = 0;
  private lastCleanup: number = Date.now();

  constructor(config: CacheConfig) {
    this.config = {
      maxItems: 1000,
      defaultTTL: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 60 * 1000, // 1分钟
      ...config
    };
    
    // 启动自动清理任务
    if (this.config.cleanupInterval > 0) {
      setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存项或undefined
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      return undefined;
    }
    
    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    // 更新访问时间和命中次数
    item.lastAccessedAt = Date.now();
    item.hits++;
    
    return item.value as T;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间(毫秒)，如果未指定则使用默认值
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // 检查是否需要清理
    if (this.cache.size >= this.config.maxItems) {
      this.evictItems();
    }
    
    const expireAt = ttl ? Date.now() + ttl : Date.now() + this.config.defaultTTL;
    
    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: expireAt,
      hits: 0
    });
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.evictionCount = 0;
  }

  /**
   * 检查键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  getStats(): CacheStats {
    let totalHits = 0;
    let totalSize = 0;
    let oldestItem = Date.now();
    let newestItem = 0;
    
    this.cache.forEach(item => {
      totalHits += item.hits;
      totalSize += this.estimateSize(item.value) || 0;
      oldestItem = Math.min(oldestItem, item.createdAt);
      newestItem = Math.max(newestItem, item.createdAt);
    });
    
    const totalItems = this.cache.size;
    const totalMisses = this.evictionCount; // 简化的估计
    const hitRate = totalHits / (totalHits + totalMisses || 1);
    
    return {
      totalItems,
      totalHits,
      totalMisses,
      hitRate,
      memoryUsage: totalSize,
      oldestItemAge: oldestItem ? Date.now() - oldestItem : 0,
      newestItemAge: newestItem ? Date.now() - newestItem : 0,
    };
  }

  /**
   * 分析缓存，提供优化建议
   * @returns 分析结果
   */
  analyzeCache(): Record<string, any> {
    const stats = this.getStats();
    const totalRequests = stats.totalHits + stats.totalMisses;
    const analysis: Record<string, any> = {
      hitRate: stats.hitRate,
      evictionRate: stats.totalItems > 0 ? this.evictionCount / stats.totalItems : 0,
      suggestions: []
    };
    
    // 命中率分析
    if (stats.hitRate < 0.5 && totalRequests > 100) {
      analysis.suggestions.push('命中率低于50%，考虑调整缓存策略或增加TTL');
    }
    
    // 缓存大小分析
    if (stats.totalItems >= this.config.maxItems * 0.9) {
      analysis.suggestions.push('缓存接近容量上限，考虑增加maxItems或减少TTL');
    }
    
    // 内存使用分析
    const memoryUsageMB = stats.memoryUsage / (1024 * 1024);
    if (memoryUsageMB > 100) { // 超过100MB作为示例阈值
      analysis.suggestions.push(`缓存内存使用较高 (${memoryUsageMB.toFixed(2)}MB)，考虑启用压缩或减少maxItems`);
    }
    
    return analysis;
  }

  /**
   * 清理过期项目
   * @returns 清理的项目数
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;
    
    this.cache.forEach((item, key) => {
      if (item.expiresAt && item.expiresAt < now) {
        this.cache.delete(key);
        removedCount++;
      }
    });
    
    this.lastCleanup = now;
    return removedCount;
  }

  /**
   * 根据策略淘汰缓存项
   * @returns 淘汰的项目数
   */
  private evictItems(): number {
    // 如果缓存未满，无需淘汰
    if (this.cache.size < this.config.maxItems) {
      return 0;
    }
    
    // 计算需要淘汰的数量 (默认淘汰25%)
    const evictCount = Math.ceil(this.config.maxItems * 0.25);
    
    // 按最近访问时间排序
    const sortedItems = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)
      .slice(0, evictCount);
    
    // 淘汰项目
    for (const [key] of sortedItems) {
      this.cache.delete(key);
      this.evictionCount++;
    }
    
    return evictCount;
  }

  /**
   * 估计对象大小(字节)
   * @param obj 要估计大小的对象
   * @returns 估计的字节大小
   */
  private estimateSize(obj: any): number {
    // 简单实现，实际生产中可以使用更精确的算法
    if (obj === null || obj === undefined) return 0;
    
    const json = JSON.stringify(obj);
    // UTF-16 编码中每个字符大约2字节
    return json.length * 2;
  }
} 