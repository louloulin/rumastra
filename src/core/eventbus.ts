import { EventEmitter } from 'events';

/**
 * 表示事件订阅的接口
 */
export interface Subscription {
  /**
   * 取消订阅
   */
  unsubscribe(): void;
}

/**
 * 事件处理器类型，接收任意数据
 */
export type EventHandler = (data: any) => void;

export type EventListener = (...args: any[]) => void;

/**
 * TypedEventEmitter provides a type-safe event emitter interface
 */
export interface TypedEventEmitter<Events extends Record<string, any>> {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void;
  off<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
  once<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void;
}

/**
 * 事件总线，用于组件间通信
 * 支持类型安全和传统字符串事件名两种模式
 */
export class EventBus<Events extends Record<string, any> = Record<string, any>> implements TypedEventEmitter<Events> {
  private listeners: Map<string | symbol, Set<EventHandler>> = new Map();

  /**
   * 发布事件到总线（向后兼容方法）
   * @param eventName 事件名称
   * @param data 事件数据
   */
  publish(eventName: string, data: any): void {
    this.emit(eventName as any, data);
  }

  /**
   * 订阅事件（向后兼容方法）
   * @param eventName 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅的函数
   */
  subscribe(eventName: string, handler: EventHandler): () => void {
    return this.on(eventName as any, handler);
  }

  /**
   * 批量订阅多个事件（向后兼容方法）
   * @param events 事件名称到处理器的映射
   * @returns 取消所有订阅的函数
   */
  subscribeAll(events: Record<string, EventHandler>): () => void {
    const unsubscribers: Array<() => void> = [];

    for (const [eventName, handler] of Object.entries(events)) {
      unsubscribers.push(this.subscribe(eventName, handler));
    }

    // 返回取消所有订阅的函数
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * 获取指定主题的订阅者数量（向后兼容方法）
   * @param topic 事件主题
   * @returns 订阅者数量
   */
  getSubscriberCount(topic: string): number {
    return this.listenerCount(topic as any);
  }

  /**
   * 检查指定主题是否有订阅者（向后兼容方法）
   * @param topic 事件主题
   * @returns 是否有订阅者
   */
  hasSubscribers(topic: string): boolean {
    return this.getSubscriberCount(topic) > 0;
  }

  /**
   * 订阅事件（类型安全方法）
   * @param event 事件名称
   * @param listener 事件监听器
   * @returns 取消订阅的函数
   */
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    
    const eventListeners = this.listeners.get(event as string)!;
    eventListeners.add(listener);
    
    return () => this.off(event, listener);
  }

  /**
   * 取消订阅事件（类型安全方法）
   * @param event 事件名称
   * @param listener 事件监听器
   */
  off<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): void {
    const eventListeners = this.listeners.get(event as string);
    
    if (eventListeners) {
      eventListeners.delete(listener);
      
      if (eventListeners.size === 0) {
        this.listeners.delete(event as string);
      }
    }
  }

  /**
   * 发出事件（类型安全方法）
   * @param event 事件名称
   * @param payload 事件数据
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const eventListeners = this.listeners.get(event as string);
    
    if (eventListeners) {
      // 创建副本以避免在迭代过程中修改集合的问题
      const listeners = Array.from(eventListeners);
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for event "${String(event)}":`, error);
        }
      }
    }
  }

  /**
   * 订阅一次性事件（类型安全方法）
   * @param event 事件名称
   * @param listener 事件监听器
   * @returns 取消订阅的函数
   */
  once<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    const wrappedListener = (payload: Events[K]) => {
      this.off(event, wrappedListener);
      listener(payload);
    };
    
    return this.on(event, wrappedListener);
  }

  /**
   * 清除事件监听器
   * @param event 可选的事件名称，如果不提供则清除所有事件
   */
  clear(event?: keyof Events | string): void {
    if (event) {
      this.listeners.delete(event as string);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: keyof Events): number {
    const eventListeners = this.listeners.get(event as string);
    return eventListeners ? eventListeners.size : 0;
  }
}