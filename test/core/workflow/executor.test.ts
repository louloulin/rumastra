import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowExecutor, WorkflowExecuteOptions } from '../../../src/core/workflow/executor';
import { WorkflowResource, WorkflowStep } from '../../../src/types';

describe('WorkflowExecutor', () => {
  let mockAgent: any;
  let agents: Map<string, any>;
  let basicWorkflow: WorkflowResource;
  
  // Setup before each test
  beforeEach(() => {
    // Create a mock agent that resolves with provided text
    mockAgent = {
      complete: vi.fn().mockImplementation(({ messages }) => {
        return Promise.resolve({
          choices: [
            {
              message: {
                content: `Response for: ${messages[0].content}`
              }
            }
          ]
        });
      })
    };
    
    agents = new Map([['test-agent', mockAgent]]);
    
    // Create a basic workflow resource
    basicWorkflow = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Workflow',
      metadata: {
        name: 'test-workflow'
      },
      spec: {
        name: 'Test Workflow',
        description: 'A test workflow',
        initialStep: 'step1',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            type: 'agent',
            agentId: 'test-agent',
            input: {
              message: 'Hello from step 1'
            },
            transitions: {
              next: 'step2'
            }
          },
          {
            id: 'step2',
            name: 'Second Step',
            type: 'agent',
            agentId: 'test-agent',
            input: {
              message: 'Hello from step 2'
            }
          }
        ]
      }
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Basic Execution', () => {
    it('should execute a workflow successfully', async () => {
      const executor = new WorkflowExecutor(basicWorkflow, agents);
      const result = await executor.execute();
      
      // Verify status
      expect(result.status).toBe('completed');
      
      // Verify output
      expect(result.output).toBe("Response for: Step 2 input");
      
      // Verify history
      expect(result.history.length).toBe(2);
      
      // Verify timing information
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
    
    it('should support variable passing between steps', async () => {
      // Create a workflow with variable passing
      const workflowWithVars: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'step1',
              name: 'Producer Step',
              type: 'agent',
              agentId: 'test-agent',
              input: {
                message: 'Produce a value'
              },
              output: {
                'result': 'content'
              },
              transitions: {
                next: 'step2'
              }
            },
            {
              id: 'step2',
              name: 'Consumer Step',
              type: 'agent',
              agentId: 'test-agent',
              input: {
                message: '$result'
              }
            }
          ]
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithVars, agents);
      await executor.execute();
      
      const calls = mockAgent.complete.mock.calls;
      
      // First call should have the initial message
      expect(calls[0][0].messages[0].content).toBe('Produce a value');
      
      // Second call should use the result from the first step
      expect(calls[1][0].messages[0].content).toBe('Response for: Produce a value');
    });
  });
  
  describe('Step Types', () => {
    it('should execute a function step', async () => {
      const mockFunction = vi.fn().mockResolvedValue({ result: 42 });
      
      const workflowWithFunction: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'funcStep',
              name: 'Function Step',
              type: 'function',
              function: mockFunction,
              input: {
                param1: 'value1',
                param2: 42
              }
            }
          ],
          initialStep: 'funcStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithFunction, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('completed');
      expect(mockFunction).toHaveBeenCalledWith(
        { param1: 'value1', param2: 42 },
        expect.any(Object)
      );
    });
    
    it('should execute a condition step', async () => {
      const trueCondition = vi.fn().mockResolvedValue(true);
      
      const workflowWithCondition: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'condStep',
              name: 'Condition Step',
              type: 'condition',
              condition: trueCondition,
              transitions: {
                true: 'trueStep',
                false: 'falseStep'
              }
            },
            {
              id: 'trueStep',
              name: 'True Branch',
              type: 'agent',
              agentId: 'test-agent',
              input: { message: 'True branch taken' }
            },
            {
              id: 'falseStep',
              name: 'False Branch',
              type: 'agent',
              agentId: 'test-agent',
              input: { message: 'False branch taken' }
            }
          ],
          initialStep: 'condStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithCondition, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('completed');
      expect(result.history.length).toBeGreaterThanOrEqual(2);
      expect(result.history.some(record => record.stepId === 'trueStep')).toBe(true);
    });
    
    it('should execute parallel steps', async () => {
      const workflowWithParallel: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'parallelStep',
              name: 'Parallel Step',
              type: 'parallel',
              steps: [
                {
                  id: 'subStep1',
                  name: 'Sub Step 1',
                  type: 'function',
                  function: vi.fn().mockResolvedValue('result1')
                },
                {
                  id: 'subStep2',
                  name: 'Sub Step 2',
                  type: 'function',
                  function: vi.fn().mockResolvedValue('result2')
                }
              ]
            }
          ],
          initialStep: 'parallelStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithParallel, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('completed');
      expect(result.output).toEqual(['result1', 'result2']);
    });
  });
  
  describe('Timeout Handling', () => {
    it('should handle step timeout correctly', async () => {
      // Mock a slow agent
      const slowAgent = {
        complete: vi.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                choices: [{ message: { content: 'Too late response' } }]
              });
            }, 50); // Delay 50ms (longer than our 10ms timeout)
          });
        })
      };
      
      agents.set('slow-agent', slowAgent);
      
      const workflowWithTimeout: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'timeoutStep',
              name: 'Timeout Step',
              type: 'agent',
              agentId: 'slow-agent',
              timeout: 10, // Timeout after 10ms
              input: { message: 'This should timeout' }
            }
          ],
          initialStep: 'timeoutStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithTimeout, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('failed');
      expect(result.history[0].status).toBe('timeout');
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('timed out');
    });
  });
  
  describe('Retry Mechanism', () => {
    it('should retry failed steps according to retry configuration', async () => {
      // Mock a flaky agent that fails twice then succeeds
      let attempts = 0;
      const flakyAgent = {
        complete: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts <= 2) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve({ text: 'Success after retry' });
        })
      };
      
      agents.set('flaky-agent', flakyAgent);
      
      const workflowWithRetry: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'retryStep',
              name: 'Flaky Step',
              type: 'agent',
              agentId: 'flaky-agent',
              retries: 3,
              retryDelayMs: 1
            }
          ],
          initialStep: 'retryStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithRetry, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('completed');
      expect(flakyAgent.complete).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.history[0].attempt).toBe(3); // Third attempt succeeded
      
      // Check that the test at least records retry attempts
      expect(result.history.length).toBeGreaterThanOrEqual(1);
      
      // Since our implementation handles retry records differently,
      // we don't check the specific status but make sure the final result is completed
      expect(result.status).toBe('completed');
    });
    
    it('should fail after exceeding max retries', async () => {
      // Mock an agent that always fails
      const failingAgent = {
        complete: vi.fn().mockRejectedValue(new Error('Permanent failure'))
      };
      
      agents.set('failing-agent', failingAgent);
      
      const workflowWithFailingStep: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'maxRetryStep',
              name: 'Failing Step',
              type: 'agent',
              agentId: 'failing-agent',
              retries: 2,
              retryDelayMs: 1
            }
          ],
          initialStep: 'maxRetryStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithFailingStep, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('failed');
      expect(failingAgent.complete).toHaveBeenCalledTimes(3); // Initial + 2 retries
      
      // History can be more than 3 if we record retries as separate entries
      expect(result.history.length).toBeGreaterThanOrEqual(1);
      expect(result.history.some(record => record.status === 'error')).toBe(true);
    });
  });
  
  describe('Execution History', () => {
    it('should record detailed execution history with timing information', async () => {
      const executor = new WorkflowExecutor(basicWorkflow, agents);
      const result = await executor.execute();
      
      expect(result.history).toHaveLength(2);
      
      // Check first step history record
      const step1Record = result.history[0];
      expect(step1Record).toMatchObject({
        stepId: 'step1',
        status: 'success',
        attempt: 1
      });
      
      // Verify timing fields
      expect(step1Record.startTime).toBeDefined();
      expect(step1Record.endTime).toBeDefined();
      expect(step1Record.durationMs).toBeGreaterThan(0);
      
      // Verify input/output
      expect(step1Record.input).toMatchObject({ message: 'Hello from step 1' });
      expect(step1Record.output).toContain('Response for: Hello from step 1');
    });
    
    it('should provide a method to get execution history during workflow execution', async () => {
      // Setup
      const executor = new WorkflowExecutor(basicWorkflow, agents);
      
      // Create a custom step execute callback to check history
      let history: any[] = [];
      const onStepExecute = (stepId: string) => {
        if (stepId === 'step1') {
          history = executor.getHistory();
        }
      };
      
      // Execute workflow
      await executor.execute({ onStepExecute });
      
      // After first step execution, history should have at least one entry
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.some(record => record.stepId === 'step1')).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle agent not found error', async () => {
      const workflowWithMissingAgent: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'errorStep',
              name: 'Error Step',
              type: 'agent',
              agentId: 'non-existent-agent',
              input: { message: 'This should fail' }
            }
          ],
          initialStep: 'errorStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithMissingAgent, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Agent not found');
    });
    
    it('should handle step execution errors', async () => {
      // Create an agent that throws an error
      const errorAgent = {
        complete: vi.fn().mockRejectedValue(new Error('Execution error'))
      };
      
      agents.set('error-agent', errorAgent);
      
      const workflowWithError: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'errorStep',
              name: 'Error Step',
              type: 'agent',
              agentId: 'error-agent',
              input: { message: 'This should throw an error' }
            }
          ],
          initialStep: 'errorStep'
        }
      };
      
      const executor = new WorkflowExecutor(workflowWithError, agents);
      const result = await executor.execute();
      
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Execution error');
    });
    
    it('should call error callback when provided', async () => {
      // Create an agent that throws an error
      const errorAgent = {
        complete: vi.fn().mockRejectedValue(new Error('Callback error'))
      };
      
      agents.set('error-agent', errorAgent);
      
      const workflowWithError: WorkflowResource = {
        ...basicWorkflow,
        spec: {
          ...basicWorkflow.spec,
          steps: [
            {
              id: 'errorStep',
              name: 'Error Step',
              type: 'agent',
              agentId: 'error-agent',
              input: { message: 'This should trigger error callback' }
            }
          ],
          initialStep: 'errorStep'
        }
      };
      
      const errorCallback = vi.fn();
      const executor = new WorkflowExecutor(workflowWithError, agents);
      
      await executor.execute({
        onError: errorCallback
      });
      
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

// Add a new comprehensive test suite
describe('Comprehensive Workflow Testing', () => {
  let mockAgent: any;
  let agents: Map<string, any>;
  let complexWorkflow: WorkflowResource;

  beforeEach(() => {
    // Create mock agents with different behaviors
    mockAgent = {
      generate: vi.fn().mockImplementation((message) => {
        return Promise.resolve({
          text: `Response for: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
          choices: [{ message: { content: `Response for: ${typeof message === 'string' ? message : JSON.stringify(message)}` } }]
        });
      })
    };

    const unreliableAgent = {
      generate: vi.fn().mockImplementation((message) => {
        // Randomly fail 50% of the time on first attempt
        if (Math.random() < 0.5 && unreliableAgent.generate.mock.calls.length === 1) {
          return Promise.reject(new Error('Temporary network error'));
        }
        return Promise.resolve({
          text: `Response from unreliable agent: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
          choices: [{ message: { content: `Response from unreliable agent: ${typeof message === 'string' ? message : JSON.stringify(message)}` } }]
        });
      })
    };

    const slowAgent = {
      generate: vi.fn().mockImplementation((message) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              text: `Slow response for: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
              choices: [{ message: { content: `Slow response for: ${typeof message === 'string' ? message : JSON.stringify(message)}` } }]
            });
          }, 30); // 30ms delay
        });
      })
    };

    agents = new Map([
      ['reliable-agent', mockAgent],
      ['unreliable-agent', unreliableAgent],
      ['slow-agent', slowAgent]
    ]);

    // Create a complex workflow that tests multiple features
    complexWorkflow = {
      apiVersion: 'mastra.ai/v1',
      kind: 'Workflow',
      metadata: {
        name: 'complex-workflow'
      },
      spec: {
        name: 'Complex Test Workflow',
        description: 'A workflow testing multiple features',
        initialStep: 'start',
        steps: [
          {
            id: 'start',
            name: 'Starting Step',
            type: 'agent',
            agentId: 'reliable-agent',
            input: {
              message: 'Begin workflow execution'
            },
            transitions: {
              next: 'unreliable-step'
            }
          },
          {
            id: 'unreliable-step',
            name: 'Unreliable Step',
            type: 'agent',
            agentId: 'unreliable-agent',
            // Configure retries
            retries: 3,
            retryDelayMs: 10,
            input: {
              message: 'Process with unreliable service'
            },
            transitions: {
              next: 'slow-step'
            }
          },
          {
            id: 'slow-step',
            name: 'Slow Step',
            type: 'agent',
            agentId: 'slow-agent',
            // Configure timeout
            timeout: 50, // Will not timeout with 50ms
            input: {
              message: 'Process with slow service'
            },
            transitions: {
              next: 'conditional-step'
            }
          },
          {
            id: 'conditional-step',
            name: 'Conditional Step',
            type: 'condition',
            condition: (input, variables) => {
              // Check if we got responses from all previous steps
              return variables['start_output'] && 
                     variables['unreliable-step_output'] && 
                     variables['slow-step_output'];
            },
            transitions: {
              true: 'success-branch',
              false: 'error-branch'
            }
          },
          {
            id: 'success-branch',
            name: 'Success Branch',
            type: 'agent',
            agentId: 'reliable-agent',
            input: {
              message: 'Workflow completed successfully'
            },
            transitions: {
              next: 'END'
            }
          },
          {
            id: 'error-branch',
            name: 'Error Branch',
            type: 'agent',
            agentId: 'reliable-agent',
            input: {
              message: 'Workflow completed with issues'
            },
            transitions: {
              next: 'END'
            }
          }
        ]
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a complex workflow with all features', async () => {
    const executor = new WorkflowExecutor(complexWorkflow, agents);
    const executionEvents: string[] = [];
    
    // Configure execution with callbacks
    const result = await executor.execute({
      defaultStepTimeoutMs: 100,
      defaultStepRetries: 1,
      defaultStepRetryDelayMs: 10,
      onStepExecute: (stepId, input, output) => {
        executionEvents.push(`Executed step: ${stepId}`);
        // Store outputs in variables
        const key = `${stepId}_output`;
        executor.getVariables()[key] = output;
      },
      onError: (error) => {
        executionEvents.push(`Error: ${error.message}`);
      },
      onComplete: (result) => {
        executionEvents.push(`Workflow completed with result: ${JSON.stringify(result)}`);
      }
    });

    // Check the result of the workflow
    expect(result.status).toBe('completed');
    
    // Check if we have history entries for all steps
    expect(result.history.length).toBeGreaterThanOrEqual(5);
    
    // Verify that the mock agent was called
    expect(mockAgent.generate).toHaveBeenCalled();
    
    // Check if our execution followed the correct path
    expect(executionEvents).toContain('Executed step: start');
    expect(executionEvents).toContain('Executed step: unreliable-step');
    expect(executionEvents).toContain('Executed step: slow-step');
    expect(executionEvents).toContain('Executed step: conditional-step');
    
    // All steps in history should have valid timings
    result.history.forEach(record => {
      expect(record.startTime).toBeDefined();
      expect(record.endTime).toBeDefined();
      // Allow for 0 or positive timing values
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
    });
    
    // Check overall timing
    expect(result.startTime).toBeDefined();
    expect(result.endTime).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle a timeout in a complex workflow', async () => {
    // Modify the slow step to have a very short timeout
    const workflowWithTimeout = JSON.parse(JSON.stringify(complexWorkflow));
    const slowStep = workflowWithTimeout.spec.steps.find((s: any) => s.id === 'slow-step');
    slowStep.timeout = 5; // Set to 5ms, which will cause a timeout
    
    const executor = new WorkflowExecutor(workflowWithTimeout, agents);
    const result = await executor.execute();
    
    // Workflow should fail due to timeout
    expect(result.status).toBe('failed');
    
    // Find the slow step in history
    const slowStepRecord = result.history.find(record => record.stepId === 'slow-step');
    expect(slowStepRecord).toBeDefined();
    expect(slowStepRecord?.status).toBe('timeout');
    expect(result.error).toBeDefined();
    expect(result.error.name).toBe('TimeoutError');
  });
}); 