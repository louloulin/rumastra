/**
 * NetworkState类
 * 用于管理网络的共享状态，提供了获取、设置、更新、检查存在性、删除键等功能
 */
export class NetworkState {
  // 使用Map存储状态
  private state: Map<string, any>;

  /**
   * 构造函数
   * @param initialState 可选的初始状态对象
   */
  constructor(initialState?: Record<string, any>) {
    this.state = new Map();
    
    // 如果提供了初始状态，则加载它
    if (initialState) {
      Object.entries(initialState).forEach(([key, value]) => {
        this.set(key, value);
      });
    }
  }

  /**
   * 获取指定键的值
   * @param key 要获取的键名
   * @param defaultValue 如果键不存在时返回的默认值
   * @returns 存储的值或默认值
   */
  get<T = any>(key: string, defaultValue?: T): T {
    return this.state.has(key) ? this.state.get(key) : (defaultValue as T);
  }

  /**
   * 设置键值对
   * @param key 键名
   * @param value 要存储的值
   * @returns this实例，用于链式调用
   */
  set(key: string, value: any): this {
    this.state.set(key, value);
    return this;
  }

  /**
   * 更新多个值
   * @param values 要更新的键值对对象
   * @returns this实例，用于链式调用
   */
  update(values: Record<string, any>): this {
    Object.entries(values).forEach(([key, value]) => {
      this.set(key, value);
    });
    return this;
  }

  /**
   * 检查键是否存在
   * @param key 要检查的键名
   * @returns 是否存在该键
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * 删除指定键
   * @param key 要删除的键名
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    return this.state.delete(key);
  }

  /**
   * 将状态转换为普通对象
   * @returns 表示状态的普通对象
   */
  toObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.state.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * 创建当前状态的克隆
   * @returns 新的NetworkState实例，包含相同的状态
   */
  clone(): NetworkState {
    return new NetworkState(this.toObject());
  }

  /**
   * 清空状态
   * @returns this实例，用于链式调用
   */
  clear(): this {
    this.state.clear();
    return this;
  }

  /**
   * 获取所有键
   * @returns 键的迭代器
   */
  keys(): IterableIterator<string> {
    return this.state.keys();
  }

  /**
   * 获取所有值
   * @returns 值的迭代器
   */
  values(): IterableIterator<any> {
    return this.state.values();
  }

  /**
   * 获取状态大小（键值对数量）
   */
  get size(): number {
    return this.state.size;
  }
} 