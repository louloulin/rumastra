import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { NetworkController } from '../../../src/core/network/controller';
import { NetworkStateStore } from '../../../src/core/network/store';
import { NetworkResource } from '../../../src/types';

describe('NetworkController', () => {
  let eventBus: EventBus;
  let stateStore: NetworkStateStore;
  let controller: NetworkController;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus();
    stateStore = {
      getNetworkState: vi.fn<[string], Promise<any>>().mockResolvedValue(null),
      updateNetworkState: vi.fn<[string, any], Promise<void>>().mockResolvedValue(undefined),
      deleteNetworkState: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined),
      watchNetworkState: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined)
    };
    controller = new NetworkController(eventBus, stateStore);

    // 监听事件
    vi.spyOn(eventBus, 'emit');
    vi.spyOn(eventBus, 'publish');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const validNetworkResource: NetworkResource = {
    apiVersion: 'mastra.ai/v1',
    kind: 'Network',
    metadata: {
      name: 'test-network',
      namespace: 'default'
    },
    spec: {
      instructions: 'Test network instructions',
      agents: [{
        name: 'agent1',
        ref: 'default.agent1'
      }],
      router: {
        model: {
          provider: 'openai',
          name: 'gpt-4'
        },
        maxSteps: 10
      }
    }
  };

  describe('Resource Validation', () => {
    it('should validate valid network resource', async () => {
      await expect(controller.validateResource(validNetworkResource))
        .resolves.not.toThrow();
    });

    it('should reject network without spec', async () => {
      const invalidResource = { ...validNetworkResource } as NetworkResource;
      delete (invalidResource as any).spec;
      await expect(controller.validateResource(invalidResource))
        .rejects.toThrow('Network resource must have a spec');
    });

    it('should reject network without router', async () => {
      const invalidResource = { 
        ...validNetworkResource,
        spec: { 
          ...validNetworkResource.spec,
          router: undefined as any
        }
      };
      await expect(controller.validateResource(invalidResource))
        .rejects.toThrow('Network must have a router configuration');
    });

    it('should reject network without agents', async () => {
      const invalidResource = {
        ...validNetworkResource,
        spec: { 
          ...validNetworkResource.spec,
          agents: []
        }
      };
      await expect(controller.validateResource(invalidResource))
        .rejects.toThrow('Network must have at least one agent');
    });

    it('should reject agent without name', async () => {
      const invalidResource = {
        ...validNetworkResource,
        spec: {
          ...validNetworkResource.spec,
          agents: [{ ref: 'default.agent1' } as any]
        }
      };
      await expect(controller.validateResource(invalidResource))
        .rejects.toThrow('Each agent must have a name');
    });

    it('should reject agent without reference', async () => {
      const invalidResource = {
        ...validNetworkResource,
        spec: {
          ...validNetworkResource.spec,
          agents: [{ name: 'agent1' } as any]
        }
      };
      await expect(controller.validateResource(invalidResource))
        .rejects.toThrow('Agent agent1 must have a reference');
    });
  });

  describe('State Management', () => {
    it('should initialize network state correctly', async () => {
      const mockGetState = vi.fn<[string], Promise<any>>();
      mockGetState.mockResolvedValueOnce(null);
      stateStore.getNetworkState = mockGetState;
      
      await controller.reconcile(validNetworkResource);
      
      expect(stateStore.updateNetworkState).toHaveBeenCalledWith(
        'default.test-network',
        expect.objectContaining({
          networkId: 'default.test-network',
          instructions: 'Test network instructions',
          agentCount: 1,
          router: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4',
            maxSteps: 10
          }),
          stats: expect.objectContaining({
            totalExecutions: 0,
            lastExecutionTime: null,
            averageStepCount: 0
          })
        })
      );
    });

    it('should update network stats after execution', async () => {
      const mockGetState = vi.fn<[string], Promise<any>>();
      mockGetState.mockResolvedValueOnce({
        networkId: 'default.test-network',
        stats: {
          totalExecutions: 1,
          lastExecutionTime: '2024-01-01T00:00:00.000Z',
          averageStepCount: 5
        }
      });
      stateStore.getNetworkState = mockGetState;

      await controller['updateNetworkStats']('default.test-network', { stepCount: 7 });

      expect(stateStore.updateNetworkState).toHaveBeenCalledWith(
        'default.test-network',
        expect.objectContaining({
          stats: expect.objectContaining({
            totalExecutions: 2,
            averageStepCount: 6,
            lastExecutionTime: expect.any(String)
          })
        })
      );
    });
  });

  describe('Agent Reference Resolution', () => {
    it('should resolve agent references', async () => {
      const resolvedAgents = await controller['resolveAgentReferences'](validNetworkResource);
      
      expect(resolvedAgents).toHaveLength(1);
      expect(resolvedAgents[0]).toEqual(
        expect.objectContaining({
          name: 'agent1',
          ref: 'default.agent1',
          resolved: true,
          config: expect.objectContaining({
            name: 'agent1',
            ref: 'default.agent1',
            resolvedAt: expect.any(String)
          })
        })
      );
    });
  });

  describe('Router Configuration', () => {
    it('should configure router with default maxSteps', () => {
      const resourceWithoutMaxSteps = {
        ...validNetworkResource,
        spec: {
          ...validNetworkResource.spec,
          router: {
            model: {
              provider: 'openai',
              name: 'gpt-4'
            },
            maxSteps: 10
          }
        }
      };

      const config = controller['configureRouter'](resourceWithoutMaxSteps);
      
      expect(config).toEqual(
        expect.objectContaining({
          model: expect.objectContaining({
            provider: 'openai',
            name: 'gpt-4'
          }),
          maxSteps: 10,
          configured: true,
          config: expect.objectContaining({
            model: expect.objectContaining({
              provider: 'openai',
              name: 'gpt-4'
            }),
            configuredAt: expect.any(String)
          })
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up network resources and emit event', async () => {
      await controller.cleanupResource(validNetworkResource);

      expect(stateStore.deleteNetworkState).toHaveBeenCalledWith('default.test-network');
      expect(eventBus.publish).toHaveBeenCalledWith(
        'network.cleaned',
        expect.objectContaining({
          networkId: 'default.test-network',
          resource: validNetworkResource
        })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockDeleteState = vi.fn<[string], Promise<void>>();
      mockDeleteState.mockRejectedValueOnce(new Error('Cleanup failed'));
      stateStore.deleteNetworkState = mockDeleteState;
      
      await controller.cleanupResource(validNetworkResource);
      
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
}); 