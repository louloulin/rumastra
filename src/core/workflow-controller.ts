import { EventBus } from './eventbus';
import { ResourceState, ResourceStatus } from './resource-status';

export type WorkflowEvent = 
  | 'step:start' 
  | 'step:complete' 
  | 'step:error' 
  | 'workflow:start' 
  | 'workflow:complete' 
  | 'workflow:error' 
  | 'resource:update';

export type WorkflowResource = {
  id: string;
  type: string;
  state: ResourceState;
};

export type WorkflowStep = {
  id: string;
  name: string;
  execute: () => Promise<any>;
  resources?: WorkflowResource[];
};

export type Workflow = {
  id: string;
  name: string;
  steps: WorkflowStep[];
  resources?: WorkflowResource[];
};

export type WorkflowControllerOptions = {
  eventBus?: EventBus;
};

export class WorkflowController {
  private eventBus: EventBus;
  private workflows: Map<string, Workflow> = new Map();
  private runningWorkflows: Set<string> = new Set();
  private workflowResults: Map<string, any> = new Map();

  constructor(options: WorkflowControllerOptions = {}) {
    this.eventBus = options.eventBus || new EventBus();
  }

  /**
   * Register a workflow with the controller
   */
  registerWorkflow(workflow: Workflow): void {
    if (this.workflows.has(workflow.id)) {
      throw new Error(`Workflow with id ${workflow.id} is already registered`);
    }
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Unregister a workflow from the controller
   */
  unregisterWorkflow(workflowId: string): boolean {
    if (this.runningWorkflows.has(workflowId)) {
      throw new Error(`Cannot unregister workflow ${workflowId} while it is running`);
    }
    return this.workflows.delete(workflowId);
  }

  /**
   * Get a workflow by id
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Check if a workflow is currently running
   */
  isWorkflowRunning(workflowId: string): boolean {
    return this.runningWorkflows.has(workflowId);
  }

  /**
   * Get all registered workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get the result of a completed workflow
   */
  getWorkflowResult(workflowId: string): any {
    return this.workflowResults.get(workflowId);
  }

  /**
   * Subscribe to workflow events
   */
  on<T = any>(event: WorkflowEvent, handler: (data: T) => void): () => void {
    return this.eventBus.subscribe(event, handler);
  }

  /**
   * Execute a workflow by id
   */
  async executeWorkflow(workflowId: string, context: Record<string, any> = {}): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow with id ${workflowId} not found`);
    }
    
    if (this.runningWorkflows.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} is already running`);
    }
    
    this.runningWorkflows.add(workflowId);
    
    try {
      // Mark initial resource states
      if (workflow.resources) {
        workflow.resources.forEach(resource => {
          if (resource.state.status !== ResourceStatus.PENDING) {
            resource.state.status = ResourceStatus.PENDING;
            this.eventBus.publish('resource:update', { 
              workflowId, 
              resourceId: resource.id, 
              state: resource.state 
            });
          }
        });
      }
      
      // Announce workflow start
      this.eventBus.publish('workflow:start', { 
        workflowId, 
        name: workflow.name, 
        context 
      });
      
      // Execute steps sequentially
      let result;
      for (const step of workflow.steps) {
        // Update step resources to pending
        if (step.resources) {
          step.resources.forEach(resource => {
            if (resource.state.status !== ResourceStatus.PENDING) {
              resource.state.status = ResourceStatus.PENDING;
              this.eventBus.publish('resource:update', { 
                workflowId, 
                stepId: step.id,
                resourceId: resource.id, 
                state: resource.state 
              });
            }
          });
        }
        
        // Announce step start
        this.eventBus.publish('step:start', { 
          workflowId, 
          stepId: step.id, 
          name: step.name 
        });
        
        try {
          // Execute step
          result = await step.execute();
          
          // Update step resources to ready
          if (step.resources) {
            step.resources.forEach(resource => {
              resource.state.status = ResourceStatus.READY;
              this.eventBus.publish('resource:update', { 
                workflowId, 
                stepId: step.id,
                resourceId: resource.id, 
                state: resource.state 
              });
            });
          }
          
          // Announce step completion
          this.eventBus.publish('step:complete', { 
            workflowId, 
            stepId: step.id, 
            name: step.name, 
            result 
          });
        } catch (error) {
          // Update step resources to error
          if (step.resources) {
            step.resources.forEach(resource => {
              resource.state.status = ResourceStatus.ERROR;
              resource.state.error = error instanceof Error ? error.message : String(error);
              this.eventBus.publish('resource:update', { 
                workflowId, 
                stepId: step.id,
                resourceId: resource.id, 
                state: resource.state 
              });
            });
          }
          
          // Announce step error
          this.eventBus.publish('step:error', { 
            workflowId, 
            stepId: step.id, 
            name: step.name, 
            error 
          });
          
          throw error;
        }
      }
      
      // Update workflow resources to ready
      if (workflow.resources) {
        workflow.resources.forEach(resource => {
          resource.state.status = ResourceStatus.READY;
          this.eventBus.publish('resource:update', { 
            workflowId, 
            resourceId: resource.id, 
            state: resource.state 
          });
        });
      }
      
      // Store result
      this.workflowResults.set(workflowId, result);
      
      // Announce workflow completion
      this.eventBus.publish('workflow:complete', { 
        workflowId, 
        name: workflow.name, 
        result 
      });
      
      return result;
    } catch (error) {
      // Update workflow resources to error
      if (workflow.resources) {
        workflow.resources.forEach(resource => {
          resource.state.status = ResourceStatus.ERROR;
          resource.state.error = error instanceof Error ? error.message : String(error);
          this.eventBus.publish('resource:update', { 
            workflowId, 
            resourceId: resource.id, 
            state: resource.state 
          });
        });
      }
      
      // Announce workflow error
      this.eventBus.publish('workflow:error', { 
        workflowId, 
        name: workflow.name, 
        error 
      });
      
      throw error;
    } finally {
      this.runningWorkflows.delete(workflowId);
    }
  }
} 