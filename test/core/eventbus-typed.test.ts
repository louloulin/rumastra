import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/eventbus';

// 定义类型安全的事件映射
interface TestEvents {
  'user-login': { userId: string; timestamp: number };
  'data-updated': { id: string; newValue: any };
  'error-occurred': Error;
}

describe('TypedEventBus', () => {
  let eventBus: EventBus<TestEvents>;

  beforeEach(() => {
    eventBus = new EventBus<TestEvents>();
  });

  test('should emit and listen to typed events', () => {
    const loginHandler = vi.fn();
    eventBus.on('user-login', loginHandler);
    
    const loginData = { userId: 'user123', timestamp: Date.now() };
    eventBus.emit('user-login', loginData);
    
    expect(loginHandler).toHaveBeenCalledTimes(1);
    expect(loginHandler).toHaveBeenCalledWith(loginData);
  });

  test('should allow unsubscribing from typed events', () => {
    const dataHandler = vi.fn();
    const unsubscribe = eventBus.on('data-updated', dataHandler);
    
    unsubscribe();
    eventBus.emit('data-updated', { id: '123', newValue: 'test' });
    
    expect(dataHandler).not.toHaveBeenCalled();
  });

  test('should support once method for typed events', () => {
    const errorHandler = vi.fn();
    eventBus.once('error-occurred', errorHandler);
    
    const error = new Error('Something went wrong');
    eventBus.emit('error-occurred', error);
    eventBus.emit('error-occurred', new Error('Another error'));
    
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(error);
  });

  test('should clear all listeners for a specific typed event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.on('user-login', handler1);
    eventBus.on('data-updated', handler2);
    
    eventBus.clear('user-login');
    
    eventBus.emit('user-login', { userId: 'user1', timestamp: 123 });
    eventBus.emit('data-updated', { id: '123', newValue: 'test' });
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('should correctly report listener count for typed events', () => {
    expect(eventBus.listenerCount('user-login')).toBe(0);
    
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.on('user-login', handler1);
    expect(eventBus.listenerCount('user-login')).toBe(1);
    
    eventBus.on('user-login', handler2);
    expect(eventBus.listenerCount('user-login')).toBe(2);
    
    const unsubscribe = eventBus.on('user-login', vi.fn());
    expect(eventBus.listenerCount('user-login')).toBe(3);
    
    unsubscribe();
    expect(eventBus.listenerCount('user-login')).toBe(2);
  });

  test('should maintain backward compatibility with string events', () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe('custom-event', handler);
    
    eventBus.publish('custom-event', { data: 'test' });
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
    
    unsubscribe();
    eventBus.publish('custom-event', { data: 'ignored' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should allow subscribing to multiple events at once', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.subscribeAll({
      'event1': handler1,
      'event2': handler2
    });
    
    eventBus.publish('event1', 'data1');
    eventBus.publish('event2', 'data2');
    
    expect(handler1).toHaveBeenCalledWith('data1');
    expect(handler2).toHaveBeenCalledWith('data2');
  });
}); 