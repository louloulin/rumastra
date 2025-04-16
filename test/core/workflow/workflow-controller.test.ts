import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../../src/core/eventbus';
import { WorkflowController } from '../../../src/core/workflow/controller';
import { ResourceScheduler } from '../../../src/core/scheduler/resource-scheduler';
import { WorkflowResource } from '../../../src/types';

// Helper to create a test workflow resource
const createTestWorkflow = (id: string): WorkflowResource => ({
  apiVersion: 'mastra.ai/v1',
  kind: 'Workflow',
  metadata: {
    name: id,
    namespace: 'default'
  },
  spec: {
    name: `Test Workflow ${id}`,
    description: 'A test workflow',
    steps: [
      {
        id: 'step1',
        name: 'First Step',
        agent: 'test-agent',
        next: 'step2'
      },
      {
        id: 'step2',
        name: 'Second Step',
        agent: 'test-agent',
        next: ['step3', 'step4']
      },
      {
        id: 'step3',
        name: 'Third Step',
        agent: 'test-agent'
      },
      {
        id: 'step4',
        name: 'Fourth Step',
        agent: 'test-agent'
      }
    ],
    initialStep: 'step1'
  },
  status: {
    phase: 'Pending',
    conditions: []
  }
});

describe('WorkflowController', () => {
  let eventBus: EventBus;
  let scheduler: ResourceScheduler;
  let controller: WorkflowController;
  
  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus();
    
    // Spy on eventBus methods
    vi.spyOn(eventBus, 'publish');
    vi.spyOn(eventBus, 'subscribe');
    
    // Create a scheduler with mock implementation
    scheduler = new ResourceScheduler(new EventBus());
    vi.spyOn(scheduler, 'scheduleTask').mockImplementation(async (task) => {
      const result = await task.handler();
      return {
        taskId: 'test-task-id',
        success: true,
        data: result,
        executionTimeMs: 10,
        waitTimeMs: 5,
        attempts: 1,
        resourceId: 'test-resource',
        taskType: task.type
      };
    });
    
    // Create controller with mocked scheduler
    controller = new WorkflowController(eventBus, { scheduler });
    
    // Mock findWorkflowResources to return test workflow
    vi.spyOn(controller as any, 'findWorkflowResources').mockImplementation((workflowId: string) => {
      return Promise.resolve([createTestWorkflow(workflowId)]);
    });
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize with event bus and scheduler', () => {
      expect(controller).toBeDefined();
      expect((controller as any).eventBus).toBe(eventBus);
      expect((controller as any).scheduler).toBe(scheduler);
    });
    
    it('should create a default scheduler if none provided', () => {
      const noSchedulerController = new WorkflowController(eventBus);
      expect((noSchedulerController as any).scheduler).toBeDefined();
      expect((noSchedulerController as any).scheduler).not.toBe(scheduler);
    });
    
    it('should subscribe to workflow.execute event', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('workflow.execute', expect.any(Function));
    });
  });
  
  describe('Workflow Execution', () => {
    it('should execute workflow steps in sequence', async () => {
      const executeStepsSpy = vi.spyOn(controller as any, 'executeWorkflowSteps');
      
      // Execute workflow
      await controller.executeWorkflow('test-workflow', { testParam: 'value' });
      
      // Verify steps were executed
      expect(executeStepsSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'step1',
        expect.objectContaining({ testParam: 'value' }),
        false
      );
      
      // Verify events were published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.started',
        expect.objectContaining({
          workflowId: 'test-workflow'
        })
      );
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.completed',
        expect.objectContaining({
          workflowId: 'test-workflow',
          result: expect.anything()
        })
      );
    });
    
    it('should handle execution errors', async () => {
      // Make executeWorkflowSteps throw an error
      vi.spyOn(controller as any, 'executeWorkflowSteps').mockRejectedValueOnce(
        new Error('Execution failed')
      );
      
      // Execute workflow and expect error
      await expect(controller.executeWorkflow('failed-workflow', {}))
        .rejects.toThrow('Execution failed');
      
      // Verify failure event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.failed',
        expect.objectContaining({
          workflowId: 'failed-workflow',
          error: expect.any(Error)
        })
      );
    });
    
    it('should not allow concurrent execution of the same workflow', async () => {
      // Start first execution
      const firstExecution = controller.executeWorkflow('concurrent-test', {});
      
      // Attempt second execution and expect error
      await expect(controller.executeWorkflow('concurrent-test', {}))
        .rejects.toThrow('is already running');
      
      // Complete first execution
      await firstExecution;
      
      // Now should be able to execute again
      await expect(controller.executeWorkflow('concurrent-test', {}))
        .resolves.toBeDefined();
    });
  });
  
  describe('Step Execution', () => {
    it('should execute steps and handle next steps correctly', async () => {
      const executedSteps: string[] = [];
      
      // Mock the step execution to track steps
      vi.spyOn(scheduler, 'scheduleTask').mockImplementation(async (task) => {
        const result = await task.handler();
        executedSteps.push(result.stepId);
        return {
          taskId: 'mock-task',
          success: true,
          data: result,
          executionTimeMs: 10,
          waitTimeMs: 5,
          attempts: 1,
          resourceId: 'test',
          taskType: 'test'
        };
      });
      
      // Execute workflow
      await controller.executeWorkflow('step-test', {});
      
      // Verify all steps executed in correct order
      expect(executedSteps).toEqual(['step1', 'step2', 'step3', 'step4']);
    });
    
    it('should publish step events during execution', async () => {
      // Execute workflow
      await controller.executeWorkflow('event-test', {});
      
      // Verify step start events
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.step.started',
        expect.objectContaining({
          stepId: 'step1',
        })
      );
      
      // Verify step completion events
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.step.completed',
        expect.objectContaining({
          stepId: 'step1',
        })
      );
    });
    
    it('should handle step execution errors', async () => {
      // Make a step fail
      vi.spyOn(scheduler, 'scheduleTask').mockImplementationOnce(async () => {
        throw new Error('Step execution failed');
      });
      
      // Execute workflow and expect error
      await expect(controller.executeWorkflow('failing-step', {}))
        .rejects.toThrow('Step execution failed');
      
      // Verify step failure event
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.step.failed',
        expect.objectContaining({
          stepId: 'step1',
          error: expect.any(Error)
        })
      );
    });
  });
  
  describe('Resource Handling', () => {
    it('should validate workflow steps and dependencies', () => {
      const validWorkflow = createTestWorkflow('valid-workflow');
      expect(() => (controller as any).resolveStepDependencies(validWorkflow))
        .not.toThrow();
      
      // Test with invalid next reference
      const invalidWorkflow = createTestWorkflow('invalid-workflow');
      invalidWorkflow.spec.steps[0].next = 'non-existent-step';
      expect(() => (controller as any).resolveStepDependencies(invalidWorkflow))
        .toThrow('references non-existent next step');
    });
    
    it('should handle special END step reference', () => {
      const workflowWithEnd = createTestWorkflow('workflow-with-end');
      workflowWithEnd.spec.steps[2].next = 'END';
      
      // Should not throw error for END special reference
      expect(() => (controller as any).resolveStepDependencies(workflowWithEnd))
        .not.toThrow();
    });
    
    it('should properly update workflow status during execution', async () => {
      const testWorkflow = createTestWorkflow('status-test');
      
      // Execute workflow
      await controller.executeWorkflow('status-test', {});
      
      // Verify status events
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.status.updated',
        expect.objectContaining({
          resourceId: expect.any(String),
          status: expect.any(Object)
        })
      );
      
      expect(eventBus.publish).toHaveBeenCalledWith(
        'workflow.completed',
        expect.objectContaining({
          workflowId: 'status-test'
        })
      );
    });
  });
}); 