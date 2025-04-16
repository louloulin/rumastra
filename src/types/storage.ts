/**
 * 状态存储接口
 */
export interface StateStore {
  /**
   * 获取状态
   * @param namespace 命名空间
   * @param key 键
   * @returns 状态值
   */
  get<T>(namespace: string, key: string): Promise<T | null>;
  
  /**
   * 设置状态
   * @param namespace 命名空间
   * @param key 键
   * @param value 值
   * @param ttl 过期时间（秒）
   */
  set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * 删除状态
   * @param namespace 命名空间
   * @param key 键
   */
  delete(namespace: string, key: string): Promise<void>;
  
  /**
   * 列出命名空间下的所有键
   * @param namespace 命名空间
   * @returns 键列表
   */
  keys(namespace: string): Promise<string[]>;
  
  /**
   * 清空命名空间
   * @param namespace 命名空间
   */
  clear(namespace: string): Promise<void>;
  
  /**
   * 关闭存储连接
   */
  close?(): Promise<void>;
} 