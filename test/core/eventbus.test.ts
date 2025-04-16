import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/eventbus';

// Define test event types for type safety testing
interface TestEvents {
  'test:event': { data: string };
  'user:login': { userId: number; timestamp: number };
  'user:logout': { userId: number; timestamp: number };
}

describe('EventBus', () => {
  let eventBus: EventBus<TestEvents>;

  beforeEach(() => {
    eventBus = new EventBus<TestEvents>();
  });

  describe('Basic Event Handling', () => {
    it('should emit and receive events', () => {
      const handler = vi.fn();
      eventBus.on('test:event', handler);
      
      const payload = { data: 'test data' };
      eventBus.emit('test:event', payload);
      
      expect(handler).toHaveBeenCalledWith(payload);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      const payload = { data: 'test data' };
      eventBus.emit('test:event', payload);
      
      expect(handler1).toHaveBeenCalledWith(payload);
      expect(handler2).toHaveBeenCalledWith(payload);
    });

    it('should handle unsubscribing correctly', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test:event', handler);
      
      unsubscribe();
      eventBus.emit('test:event', { data: 'test data' });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should continue executing other handlers if one throws', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const successHandler = vi.fn();
      
      // Mock console.error to prevent error output in tests
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      eventBus.on('test:event', errorHandler);
      eventBus.on('test:event', successHandler);
      
      eventBus.emit('test:event', { data: 'test data' });
      
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });

  describe('Once Subscription', () => {
    it('should only trigger once for once() subscriptions', () => {
      const handler = vi.fn();
      eventBus.once('test:event', handler);
      
      eventBus.emit('test:event', { data: 'first' });
      eventBus.emit('test:event', { data: 'second' });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'first' });
    });
  });

  describe('Subscriber Management', () => {
    it('should correctly report subscriber count', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      expect(eventBus.getSubscriberCount('test:event')).toBe(0);
      
      eventBus.on('test:event', handler1);
      expect(eventBus.getSubscriberCount('test:event')).toBe(1);
      
      eventBus.on('test:event', handler2);
      expect(eventBus.getSubscriberCount('test:event')).toBe(2);
      
      eventBus.off('test:event', handler1);
      expect(eventBus.getSubscriberCount('test:event')).toBe(1);
    });

    it('should correctly report if topic has subscribers', () => {
      const handler = vi.fn();
      
      expect(eventBus.hasSubscribers('test:event')).toBe(false);
      
      eventBus.on('test:event', handler);
      expect(eventBus.hasSubscribers('test:event')).toBe(true);
      
      eventBus.off('test:event', handler);
      expect(eventBus.hasSubscribers('test:event')).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle subscribeAll correctly', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      const unsubscribeAll = eventBus.subscribeAll({
        'test:event': handler1,
        'user:login': handler2
      });
      
      eventBus.emit('test:event', { data: 'test' });
      eventBus.emit('user:login', { userId: 1, timestamp: Date.now() });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      
      unsubscribeAll();
      
      eventBus.emit('test:event', { data: 'test again' });
      eventBus.emit('user:login', { userId: 2, timestamp: Date.now() });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should clear all subscribers for a specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      
      eventBus.clear('test:event');
      
      eventBus.emit('test:event', { data: 'test' });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(eventBus.getSubscriberCount('test:event')).toBe(0);
    });

    it('should clear all subscribers when no event specified', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('user:login', handler2);
      
      eventBus.clear();
      
      eventBus.emit('test:event', { data: 'test' });
      eventBus.emit('user:login', { userId: 1, timestamp: Date.now() });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(eventBus.getSubscriberCount('test:event')).toBe(0);
      expect(eventBus.getSubscriberCount('user:login')).toBe(0);
    });
  });
}); 