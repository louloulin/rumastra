import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { ToolController } from '../../../src/core/tool/controller';
import { ToolResource } from '../../../src/types';

// Helper to create a mock tool resource
const createToolResource = (
  name: string, 
  namespace: string = 'default',
  id: string = 'test-tool',
  description: string = 'Test tool description',
  execute: string = 'module.exports = async function(args) { return args; }'
): ToolResource => {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Tool',
    metadata: {
      name,
      namespace
    },
    spec: {
      id,
      description,
      execute,
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          output: { type: 'string' }
        }
      }
    }
  };
};

describe('ToolController', () => {
  let eventBus: EventBus;
  let controller: ToolController;
  
  beforeEach(() => {
    // Create a new EventBus for each test
    eventBus = new EventBus();
    
    // Spy on the eventBus publish method
    vi.spyOn(eventBus, 'publish');
    
    // Create a new controller
    controller = new ToolController(eventBus);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should create a controller instance', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(ToolController);
    });
  });
  
  describe('getDesiredState', () => {
    it('should return the desired state for a valid tool resource', async () => {
      // Create a valid tool resource
      const resource = createToolResource('valid-tool');
      
      // Get the desired state
      const desiredState = await controller.getDesiredState(resource);
      
      // Check the results
      expect(desiredState).toBeDefined();
      expect(desiredState.executor).toBeDefined();
      expect(desiredState.executor.path).toBe(resource.spec.execute);
      expect(desiredState.state).toBeDefined();
      expect(desiredState.state.toolId).toBe('default.valid-tool');
      expect(desiredState.state.id).toBe('test-tool');
      expect(desiredState.state.description).toBe('Test tool description');
      expect(desiredState.state.hasInputSchema).toBe(true);
      expect(desiredState.state.hasOutputSchema).toBe(true);
    });
    
    it('should throw an error for a tool resource with missing id', async () => {
      // Create an invalid tool resource (missing id)
      const resource = createToolResource('invalid-tool', 'default', '');
      
      // Expect an error when getting the desired state
      await expect(controller.getDesiredState(resource)).rejects.toThrow(/must have an id/);
    });
    
    it('should throw an error for a tool resource with missing description', async () => {
      // Create an invalid tool resource (missing description)
      const resource = createToolResource('invalid-tool', 'default', 'test-tool', '');
      
      // Expect an error when getting the desired state
      await expect(controller.getDesiredState(resource)).rejects.toThrow(/must have a description/);
    });
    
    it('should throw an error for a tool resource with missing execute function', async () => {
      // Create an invalid tool resource (missing execute)
      const resource = createToolResource('invalid-tool', 'default', 'test-tool', 'Test description', '');
      
      // Expect an error when getting the desired state
      await expect(controller.getDesiredState(resource)).rejects.toThrow(/must have an execute function/);
    });
  });
  
  describe('getCurrentState', () => {
    it('should return the current state from resource status', async () => {
      // Create a tool resource with status
      const resource = createToolResource('tool-with-status');
      resource.status = {
        phase: 'Ready',
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'ToolReady',
            message: 'Tool is ready',
            lastTransitionTime: new Date().toISOString()
          }
        ]
      };
      
      // Get the current state
      const currentState = await controller.getCurrentState(resource);
      
      // Check the results
      expect(currentState).toBeDefined();
      expect(currentState).toBe(resource.status);
    });
    
    it('should return an empty object for a resource without status', async () => {
      // Create a tool resource without status
      const resource = createToolResource('tool-without-status');
      
      // Get the current state
      const currentState = await controller.getCurrentState(resource);
      
      // Check the results
      expect(currentState).toEqual({});
    });
  });
  
  describe('reconcile', () => {
    it('should update the resource status during reconciliation', async () => {
      // Create a tool resource
      const resource = createToolResource('reconcile-tool');
      
      // Reconcile the resource
      await controller.reconcile(resource);
      
      // Check that the resource status has been updated
      expect(resource.status).toBeDefined();
      expect(resource.status!.phase).toBe('Ready');
      expect(resource.status!.conditions).toHaveLength(1);
      expect(resource.status!.conditions![0].type).toBe('Ready');
      expect(resource.status!.conditions![0].status).toBe('True');
      expect(resource.status!.conditions![0].reason).toBe('ToolReady');
    });
    
    it('should emit tool.reconciled event during reconciliation', async () => {
      // Create a tool resource
      const resource = createToolResource('event-tool');
      
      // Reconcile the resource
      await controller.reconcile(resource);
      
      // Check that the tool.reconciled event was published
      expect(eventBus.publish).toHaveBeenCalledWith('tool.reconciled', expect.objectContaining({
        resource,
        state: expect.objectContaining({
          toolId: 'default.event-tool',
          id: 'test-tool'
        })
      }));
    });
  });
  
  describe('cleanupResource', () => {
    it('should emit tool.cleaned event during cleanup', async () => {
      // Create a tool resource
      const resource = createToolResource('cleanup-tool');
      
      // Set up a mock implementation to access protected method
      const cleanupMethod = (controller as any).cleanupResource.bind(controller);
      
      // Call cleanup method directly 
      await cleanupMethod(resource);
      
      // Check that the tool.cleaned event was published
      expect(eventBus.publish).toHaveBeenCalledWith('tool.cleaned', expect.objectContaining({
        resource,
        toolId: 'default.cleanup-tool'
      }));
    });
  });
}); 