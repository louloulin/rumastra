import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { ResourceScheduler } from '../../../src/core/scheduler/resource-scheduler';
import { AgentController, AgentControllerEvents } from '../../../src/core/controllers/agent-controller';
import { AgentResource } from '../../../src/types';

describe('AgentController', () => {
  let eventBus: EventBus<AgentControllerEvents>;
  let scheduler: ResourceScheduler;
  let controller: AgentController;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus<AgentControllerEvents>();
    scheduler = new ResourceScheduler();
    controller = new AgentController(eventBus, scheduler);

    // 监听事件
    vi.spyOn(eventBus, 'emit');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Resource Validation', () => {
    it('should validate agent resource configuration', async () => {
      const invalidResource: AgentResource = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {
          // Missing required fields
        } as any
      };

      await expect(controller.reconcile(invalidResource)).rejects.toThrow(
        'must have a model configuration'
      );
    });

    it('should require instructions', async () => {
      const invalidResource: AgentResource = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {
          model: {
            provider: 'test',
            name: 'test-model'
          }
          // Missing instructions
        } as any
      };

      await expect(controller.reconcile(invalidResource)).rejects.toThrow(
        'must have instructions'
      );
    });
  });

  describe('Agent Lifecycle', () => {
    const validResource: AgentResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Agent',
      metadata: {
        name: 'test-agent',
        namespace: 'test'
      },
      spec: {
        instructions: 'Test instructions',
        model: {
          provider: 'test',
          name: 'test-model'
        }
      }
    };

    it('should create agent successfully', async () => {
      await controller.reconcile(validResource);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'agent.created',
        expect.objectContaining({
          agentId: 'test.test-agent'
        })
      );

      const state = await controller['getCurrentState'](validResource);
      expect(state.phase).toBe('Running');
    });

    it('should update agent when spec changes', async () => {
      // First create the agent
      await controller.reconcile(validResource);

      // Update the agent
      const updatedResource: AgentResource = {
        ...validResource,
        spec: {
          ...validResource.spec,
          instructions: 'Updated instructions'
        }
      };

      await controller.reconcile(updatedResource);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'agent.updated',
        expect.objectContaining({
          agentId: 'test.test-agent'
        })
      );

      const state = await controller['getCurrentState'](updatedResource);
      expect(state.phase).toBe('Running');
      expect(state.spec.instructions).toBe('Updated instructions');
    });

    it('should delete agent', async () => {
      // First create the agent
      await controller.reconcile(validResource);

      // Delete the agent
      await controller['deleteAgent']('test.test-agent');

      expect(eventBus.emit).toHaveBeenCalledWith(
        'agent.deleted',
        expect.objectContaining({
          agentId: 'test.test-agent'
        })
      );

      const state = await controller['getCurrentState'](validResource);
      expect(state.phase).toBe('Pending');
    });
  });

  describe('Error Handling', () => {
    const validResource: AgentResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Agent',
      metadata: {
        name: 'test-agent'
      },
      spec: {
        instructions: 'Test instructions',
        model: {
          provider: 'test',
          name: 'test-model'
        }
      }
    };

    it('should handle initialization errors', async () => {
      // Mock initialization to fail
      vi.spyOn(controller as any, 'initializeAgent').mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      await expect(controller.reconcile(validResource)).rejects.toThrow(
        'Initialization failed'
      );

      expect(eventBus.emit).toHaveBeenCalledWith(
        'agent.failed',
        expect.objectContaining({
          agentId: 'default.test-agent',
          error: expect.any(Error)
        })
      );

      const state = await controller['getCurrentState'](validResource);
      expect(state.phase).toBe('Failed');
      expect(state.error).toBe('Initialization failed');
    });

    it('should handle cleanup errors', async () => {
      // First create the agent
      await controller.reconcile(validResource);

      // Mock cleanup to fail
      vi.spyOn(controller as any, 'cleanupAgent').mockRejectedValueOnce(
        new Error('Cleanup failed')
      );

      await expect(
        controller['deleteAgent']('default.test-agent')
      ).rejects.toThrow('Cleanup failed');

      expect(eventBus.emit).toHaveBeenCalledWith(
        'agent.failed',
        expect.objectContaining({
          agentId: 'default.test-agent',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('Resource Watching', () => {
    const validResource: AgentResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Agent',
      metadata: {
        name: 'test-agent'
      },
      spec: {
        instructions: 'Test instructions',
        model: {
          provider: 'test',
          name: 'test-model'
        }
      }
    };

    it('should reconcile on resource added event', async () => {
      // Spy on reconcile method
      const reconcileSpy = vi.spyOn(controller, 'reconcile');

      // Emit resource added event
      eventBus.emit('controller.resource.added', { resource: validResource });

      expect(reconcileSpy).toHaveBeenCalledWith(validResource);
    });

    it('should reconcile on resource updated event', async () => {
      // Spy on reconcile method
      const reconcileSpy = vi.spyOn(controller, 'reconcile');

      // Emit resource updated event
      eventBus.emit('controller.resource.updated', { resource: validResource });

      expect(reconcileSpy).toHaveBeenCalledWith(validResource);
    });

    it('should delete on resource deleted event', async () => {
      // First create the agent
      await controller.reconcile(validResource);

      // Spy on deleteAgent method
      const deleteAgentSpy = vi.spyOn(controller as any, 'deleteAgent');

      // Emit resource deleted event
      eventBus.emit('controller.resource.deleted', { resource: validResource });

      expect(deleteAgentSpy).toHaveBeenCalledWith('default.test-agent');
    });
  });
}); 