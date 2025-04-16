import { NetworkState } from './state';
import { EventBus } from '../eventbus';

/**
 * 订阅类型，用于表示对网络状态的订阅
 */
export interface Subscription {
  /**
   * 取消订阅
   */
  unsubscribe(): void;
}

/**
 * 网络状态存储接口
 */
export interface NetworkStateStore {
  /**
   * 获取网络状态
   * @param networkId 网络ID
   * @returns 网络状态对象
   */
  getNetworkState(networkId: string): Promise<any>;
  
  /**
   * 更新网络状态
   * @param networkId 网络ID
   * @param state 状态对象
   */
  updateNetworkState(networkId: string, state: any): Promise<void>;
  
  /**
   * 删除网络状态
   * @param networkId 网络ID
   */
  deleteNetworkState(networkId: string): Promise<void>;
  
  /**
   * 监听网络状态
   * @param networkId 网络ID
   */
  watchNetworkState(networkId: string): Promise<void>;
}

/**
 * 内存网络状态存储
 * 基于内存存储网络状态，用于测试和简单应用
 */
export class InMemoryNetworkStateStore implements NetworkStateStore {
  private states: Map<string, any> = new Map();
  
  async getNetworkState(networkId: string): Promise<any> {
    return this.states.get(networkId) || {};
  }
  
  async updateNetworkState(networkId: string, state: any): Promise<void> {
    this.states.set(networkId, state);
  }
  
  async deleteNetworkState(networkId: string): Promise<void> {
    this.states.delete(networkId);
  }
  
  async watchNetworkState(networkId: string): Promise<void> {
    // Implementation needed
  }
} 