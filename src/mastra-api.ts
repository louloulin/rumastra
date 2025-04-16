import { readFile } from 'fs/promises';
import { load, loadAll } from 'js-yaml';
import { join, resolve, dirname } from 'path';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { Agent } from '@mastra/core';

import { EventBus } from './core/eventbus';
import { RuntimeManager } from './core/runtime-manager';
import { InMemoryNetworkStateStore } from './core/network/store';
import { DSLParser } from './core/dsl-parser';
import { WorkflowExecutor } from './core/workflow/executor';
import { NetworkExecutor } from './core/network/executor';
import { 
  RuntimeResource, 
  WorkflowResource, 
  AgentResource, 
  ToolResource,
  NetworkResource,
  LLMResource,
  MastraPodSchema
} from './types';
import { SimpleResourceManager } from './simple-api';

/**
 * MastraPod class - High-level API entry point
 * for simplified loading and running of Mastra YAML DSL
 */
export class MastraPod extends EventEmitter {
  private resourceManager: SimpleResourceManager;
  private resources: Map<string, RuntimeResource> = new Map();
  private workflowExecutors: Map<string, WorkflowExecutor> = new Map();
  private networkExecutors: Map<string, NetworkExecutor> = new Map();
  private executions: Map<string, any> = new Map();
  private metadata: Record<string, any> = {};
  private env: Record<string, string> = {};
  
  /**
   * Create a MastraPod instance
   * @param options Configuration options
   */
  constructor(options: MastraPodOptions = {}) {
    super();
    this.resourceManager = new SimpleResourceManager();
    
    // Set environment variables
    this.env = options.env || process.env;
    
    // Listen for runtime events
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners() {
    const runtimeManager = this.resourceManager.runtimeManager;
    
    // Listen for resource added events
    runtimeManager.on('resource:added', (resource: RuntimeResource) => {
      const key = this.getResourceKey(resource);
      this.resources.set(key, resource);
      this.emit('resource:added', { resource });
    });
    
    // Listen for workflow events
    runtimeManager.on('workflow:step:started', (data: any) => {
      this.emit('workflow:step:started', data);
    });
    
    runtimeManager.on('workflow:step:completed', (data: any) => {
      this.emit('workflow:step:completed', data);
    });
    
    runtimeManager.on('workflow:completed', (data: any) => {
      this.emit('workflow:completed', data);
    });
    
    // Listen for agent events
    runtimeManager.on('agent:executing', (data: any) => {
      this.emit('agent:executing', data);
    });
    
    runtimeManager.on('agent:executed', (data: any) => {
      this.emit('agent:executed', data);
    });
  }
  
  /**
   * Get resource unique key
   */
  private getResourceKey(resource: RuntimeResource): string {
    const namespace = resource.metadata?.namespace || 'default';
    return `${resource.kind}.${namespace}.${resource.metadata?.name}`;
  }
  
  /**
   * Load MastraPod from YAML file
   * @param filePath YAML file path
   * @param options Loading options
   */
  static async loadFile(filePath: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
    const pod = new MastraPod({
      env: options.env
    });
    
    await pod.addFile(filePath);
    return pod;
  }
  
  /**
   * Load MastraPod from YAML content
   * @param content YAML content
   * @param options Loading options
   */
  static async loadContent(content: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
    const pod = new MastraPod({
      env: options.env
    });
    
    await pod.addContent(content);
    return pod;
  }
  
  /**
   * Create a new application instance
   */
  static createApp(options: MastraPodOptions = {}): MastraPod {
    return new MastraPod(options);
  }
  
  /**
   * Create MastraPod with default configuration
   * @param defaults Default configuration
   */
  static withDefaults(defaults: Record<string, any>): MastraPod {
    const pod = new MastraPod({ 
      env: defaults.env,
    });
    
    // Set default metadata
    if (defaults.metadata) {
      pod.metadata = { ...defaults.metadata };
    }
    
    return pod;
  }
  
  /**
   * Add YAML file to MastraPod
   * @param filePath File path
   */
  async addFile(filePath: string): Promise<MastraPod> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.addContent(content);
    } catch (error: any) {
      throw new Error(`Failed to load file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Add YAML content to MastraPod
   * @param content YAML content
   */
  async addContent(content: string): Promise<MastraPod> {
    try {
      const resources = this.parseYAML(content);
      await this.registerResources(resources);
      return this;
    } catch (error: any) {
      throw new Error(`Failed to parse YAML content: ${error.message}`);
    }
  }
  
  /**
   * Scan directory for all YAML files
   * @param dirPath Directory path
   * @param pattern Optional glob pattern, defaults to standard YAML extensions
   */
  async scanDirectory(dirPath: string, pattern?: string): Promise<MastraPod> {
    const defaultPattern = "**/*.{yaml,yml}";
    const fullPattern = join(dirPath, pattern || defaultPattern);
    const files = await glob(fullPattern);
    
    for (const file of files) {
      await this.addFile(file);
    }
    
    return this;
  }
  
  /**
   * Parse YAML content
   * @param content YAML content
   */
  parseYAML(content: string): RuntimeResource[] {
    try {
      // Try to parse as a single document
      const doc = load(content) as any;
      let resources: RuntimeResource[] = [];
      
      // If it's a MastraPod, extract metadata and resources
      if (doc && doc.kind === 'MastraPod') {
        // Save metadata
        if (doc.metadata) {
          this.metadata = { ...this.metadata, ...doc.metadata };
        }
        
        // Process global provider config
        if (doc.providers) {
          this.processProviders(doc.providers);
        }
        
        // Process memory config
        if (doc.memory) {
          this.processMemoryConfig(doc.memory);
        }
        
        // Return resource list
        resources = Array.isArray(doc.resources) 
          ? doc.resources.map(this.fixResourceMetadata.bind(this))
          : [];
      } else {
        // Parse as multi-document YAML
        const docs = loadAll(content) as any[];
        resources = docs
          .filter(Boolean)
          .map(this.fixResourceMetadata.bind(this));
      }
      
      // Store resources in the internal map for quick access
      resources.forEach(resource => {
        if (resource && resource.kind && resource.metadata?.name) {
          const key = this.getResourceKey(resource);
          this.resources.set(key, resource);
        }
      });
      
      return resources;
    } catch (error: any) {
      throw new Error(`Failed to parse YAML: ${error.message}`);
    }
  }
  
  /**
   * Process provider configuration
   */
  private processProviders(providers: Record<string, any>): void {
    // Inject provider config into runtime manager
    const runtimeManager = this.resourceManager.runtimeManager;
    
    for (const [provider, config] of Object.entries(providers)) {
      // Process environment variable references
      const resolvedConfig = this.resolveEnvVariables(config);
      runtimeManager.setProviderConfig(provider, resolvedConfig);
    }
  }
  
  /**
   * Process memory configuration
   */
  private processMemoryConfig(config: Record<string, any>): void {
    // Inject memory config into runtime manager
    const runtimeManager = this.resourceManager.runtimeManager;
    const resolvedConfig = this.resolveEnvVariables(config);
    runtimeManager.setMemoryConfig(resolvedConfig);
  }
  
  /**
   * Resolve environment variable references
   * @param obj Configuration object
   */
  private resolveEnvVariables(obj: any): any {
    if (typeof obj === 'string') {
      return this.resolveEnvString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvVariables(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveEnvVariables(value);
      }
      
      return result;
    }
    
    return obj;
  }
  
  /**
   * Resolve environment variable string
   * @param str String
   */
  private resolveEnvString(str: string): string {
    // Match ${env.VAR_NAME} pattern
    return str.replace(/\${env\.([^}]+)}/g, (match, varName) => {
      return this.env[varName] || '';
    });
  }
  
  /**
   * Fix resource metadata
   * @param resource Resource object
   */
  private fixResourceMetadata(resource: RuntimeResource): RuntimeResource {
    if (!resource) return resource;
    
    // Ensure metadata object exists
    if (!resource.metadata || typeof resource.metadata !== 'object') {
      resource.metadata = {
        name: `auto-${resource.kind?.toLowerCase() || 'unknown'}-${Date.now()}`,
        namespace: 'default'
      };
      return resource;
    }
    
    // Ensure name exists
    if (!resource.metadata.name) {
      resource.metadata.name = `auto-${resource.kind?.toLowerCase() || 'unknown'}-${Date.now()}`;
    }
    
    // Ensure namespace exists
    if (!resource.metadata.namespace) {
      resource.metadata.namespace = 'default';
    }
    
    return resource;
  }
  
  /**
   * Register resources
   * @param resources Resource array
   */
  async registerResources(resources: RuntimeResource[]): Promise<void> {
    const runtimeManager = this.resourceManager.runtimeManager;
    
    for (const resource of resources) {
      try {
        await runtimeManager.addResource(resource);
      } catch (error: any) {
        console.warn(`Failed to register resource ${resource.kind}/${resource.metadata?.name}: ${error.message}`);
      }
    }
  }
  
  /**
   * Run specified agent
   * @param agentName Agent name
   * @param input Input content
   * @param options Execution options
   */
  async runAgent(
    agentName: string, 
    input: string | Record<string, any>,
    options: AgentRunOptions = {}
  ): Promise<AgentResponse> {
    const namespace = options.namespace || 'default';
    const runtimeManager = this.resourceManager.runtimeManager;
    
    try {
      // Get agent resource
      const agentResource = this.getResource('Agent', agentName, namespace);
      if (!agentResource) {
        throw new Error(`Agent '${agentName}' not found in namespace '${namespace}'`);
      }
      
      // Create execution ID
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Form the agent ID and get agent instance
      const agentId = `${namespace}.${agentName}`;
      const agent = runtimeManager.getAgent(agentId);
      if (!agent) {
        throw new Error(`Failed to initialize agent '${agentName}'`);
      }
      
      // Prepare input
      const agentInput = typeof input === 'string' ? { message: input } : input;
      
      // Execute agent using the generate method which is standard in our implementation
      // Pass the message as the main input, with additional parameters as options
      const result = await agent.generate(
        agentInput.message || '', 
        { ...agentInput }
      );
      
      // Store execution result
      this.executions.set(executionId, {
        type: 'agent',
        agentName,
        namespace,
        input: agentInput,
        result,
        timestamp: new Date(),
        status: 'completed'
      });
      
      // Return response
      return {
        executionId,
        result,
        agent: agentName,
        status: 'completed'
      };
    } catch (error: any) {
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store error
      this.executions.set(executionId, {
        type: 'agent',
        agentName,
        namespace,
        input,
        error: error.message,
        timestamp: new Date(),
        status: 'failed'
      });
      
      // Return error response
      return {
        executionId,
        error: error.message,
        agent: agentName,
        status: 'failed'
      };
    }
  }
  
  /**
   * Run specified workflow
   * @param workflowName Workflow name
   * @param input Input content
   * @param options Execution options
   */
  async runWorkflow(
    workflowName: string, 
    input: Record<string, any> = {},
    options: WorkflowRunOptions = {}
  ): Promise<WorkflowResponse> {
    const namespace = options.namespace || 'default';
    const runtimeManager = this.resourceManager.runtimeManager;
    
    try {
      // Get workflow resource
      const workflowResource = this.getResource('Workflow', workflowName, namespace);
      if (!workflowResource) {
        throw new Error(`Workflow '${workflowName}' not found in namespace '${namespace}'`);
      }
      
      // Create execution ID
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Get workflow executor
      let executor = this.workflowExecutors.get(`${namespace}.${workflowName}`);
      
      if (!executor) {
        // Create new executor
        const agents = this.getAgentsForWorkflow(workflowResource as WorkflowResource);
        executor = new WorkflowExecutor(workflowResource as WorkflowResource, agents);
        this.workflowExecutors.set(`${namespace}.${workflowName}`, executor);
      }
      
      // Set step completion callback
      const stepCompletedCallback = (stepId: string, input: any, output: any) => {
        this.emit('workflow:step:completed', {
          executionId,
          workflowName,
          stepId,
          input,
          output
        });
      };
      
      // Execute workflow using the correct option format
      const result = await executor.execute({
        input,
        onStepExecute: stepCompletedCallback,
        onComplete: (result) => {
          this.emit('workflow:completed', {
            executionId,
            workflowName,
            result
          });
        },
        onError: (error) => {
          this.emit('workflow:error', {
            executionId,
            workflowName,
            error
          });
        }
      });
      
      // Store execution result
      this.executions.set(executionId, {
        type: 'workflow',
        workflowName,
        namespace,
        input,
        result,
        timestamp: new Date(),
        status: 'completed'
      });
      
      // Return response
      return {
        executionId,
        result: result.output,
        workflow: workflowName,
        status: result.status === 'completed' ? 'completed' : 'failed'
      };
    } catch (error: any) {
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store error
      this.executions.set(executionId, {
        type: 'workflow',
        workflowName,
        namespace,
        input,
        error: error.message,
        timestamp: new Date(),
        status: 'failed'
      });
      
      // Return error response
      return {
        executionId,
        error: error.message,
        workflow: workflowName,
        status: 'failed'
      };
    }
  }
  
  /**
   * Get agents used by workflow
   */
  private getAgentsForWorkflow(workflow: WorkflowResource): Map<string, Agent> {
    const result = new Map<string, Agent>();
    const runtimeManager = this.resourceManager.runtimeManager;
    const steps = workflow.spec?.steps || [];
    
    for (const step of steps) {
      if (step.agent && !result.has(step.agent)) {
        // Form the correct agent ID
        const agentId = step.agent;
        const agent = runtimeManager.getAgent(agentId);
        if (agent) {
          result.set(step.agent, agent);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Call tool
   * @param toolName Tool name
   * @param params Parameters
   * @param options Options
   */
  async callTool(
    toolName: string,
    params: Record<string, any> = {},
    options: ToolCallOptions = {}
  ): Promise<ToolResponse> {
    const namespace = options.namespace || 'default';
    const runtimeManager = this.resourceManager.runtimeManager;
    
    try {
      // Create execution ID
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Since there's no direct getToolFunction, we need to find an alternative
      // One option is to use an agent that has the tool
      // Or check if the tool is available in the resource list
      const toolResource = this.getResource('Tool', toolName, namespace);
      if (!toolResource) {
        throw new Error(`Tool '${toolName}' not found in namespace '${namespace}'`);
      }
      
      // For now, we'll implement a simple mock execution
      // In a real implementation, we would need to access the tool properly
      const result = {
        success: true,
        output: `Executed tool ${toolName} with parameters: ${JSON.stringify(params)}`,
        ...params  // Return the params as part of the result for demo purposes
      };
      
      // Store execution result
      this.executions.set(executionId, {
        type: 'tool',
        toolName,
        namespace,
        params,
        result,
        timestamp: new Date(),
        status: 'completed'
      });
      
      // Return response
      return {
        executionId,
        result,
        tool: toolName,
        status: 'completed'
      };
    } catch (error: any) {
      const executionId = options.executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store error
      this.executions.set(executionId, {
        type: 'tool',
        toolName,
        namespace,
        params,
        error: error.message,
        timestamp: new Date(),
        status: 'failed'
      });
      
      // Return error response
      return {
        executionId,
        error: error.message,
        tool: toolName,
        status: 'failed'
      };
    }
  }
  
  /**
   * Get specified execution result
   * @param executionId Execution ID
   */
  getResult(executionId: string): any {
    const execution = this.executions.get(executionId);
    return execution || null;
  }
  
  /**
   * Get resource
   * @param kind Resource type
   * @param name Resource name
   * @param namespace Namespace
   */
  getResource(kind: string, name: string, namespace: string = 'default'): RuntimeResource | undefined {
    return this.resources.get(`${kind}.${namespace}.${name}`);
  }
  
  /**
   * Get all resources of specified type
   * @param kind Resource type
   * @param namespace Optional namespace filter
   */
  getResourcesByKind(kind: string, namespace?: string): RuntimeResource[] {
    return Array.from(this.resources.values())
      .filter(resource => 
        resource.kind === kind && 
        (!namespace || resource.metadata?.namespace === namespace)
      );
  }
  
  /**
   * Get agent
   * @param name Agent name
   * @param namespace Namespace (used to form the agent ID)
   */
  getAgent(name: string, namespace: string = 'default'): Agent | null {
    try {
      // Form the correct agent ID format used in the runtime
      const agentId = `${namespace}.${name}`;
      return this.resourceManager.runtimeManager.getAgent(agentId);
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get all agents
   * @param namespace Optional namespace filter
   */
  getAgents(namespace?: string): AgentResource[] {
    return this.getResourcesByKind('Agent', namespace) as AgentResource[];
  }
  
  /**
   * Get all workflows
   * @param namespace Optional namespace filter
   */
  getWorkflows(namespace?: string): WorkflowResource[] {
    return this.getResourcesByKind('Workflow', namespace) as WorkflowResource[];
  }
  
  /**
   * Get all tools
   * @param namespace Optional namespace filter
   */
  getTools(namespace?: string): ToolResource[] {
    return this.getResourcesByKind('Tool', namespace) as ToolResource[];
  }
}

/**
 * Convenience function: Load and run workflow
 * @param options Run options
 */
export async function run(options: RunOptions): Promise<WorkflowResponse | AgentResponse> {
  // Create MastraPod instance
  const pod = new MastraPod({
    env: options.env
  });
  
  // Load file
  if (options.file) {
    await pod.addFile(options.file);
  } else if (options.content) {
    await pod.addContent(options.content);
  } else {
    throw new Error('Either file or content must be provided');
  }
  
  // Run workflow or agent
  if (options.workflow) {
    return pod.runWorkflow(options.workflow, options.input || {});
  } else if (options.agent) {
    return pod.runAgent(options.agent, options.input || {});
  } else {
    throw new Error('Either workflow or agent must be specified');
  }
}

/**
 * Convenience function: Load MastraPod from file
 * @param filePath File path
 * @param options Loading options
 */
export async function loadFile(filePath: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
  return MastraPod.loadFile(filePath, options);
}

/**
 * Convenience function: Load MastraPod from content
 * @param content YAML content
 * @param options Loading options
 */
export async function loadContent(content: string, options: MastraPodLoadOptions = {}): Promise<MastraPod> {
  return MastraPod.loadContent(content, options);
}

/**
 * Convenience function: Create new application
 * @param options Options
 */
export function createApp(options: MastraPodOptions = {}): MastraPod {
  return MastraPod.createApp(options);
}

/**
 * MastraPod options interface
 */
export interface MastraPodOptions {
  /**
   * Environment variable mapping for resolving environment variable references
   */
  env?: Record<string, string>;
}

/**
 * MastraPod loading options interface
 */
export interface MastraPodLoadOptions extends MastraPodOptions {
  /**
   * Whether to validate resources
   */
  validate?: boolean;
}

/**
 * Agent run options interface
 */
export interface AgentRunOptions {
  /**
   * Namespace
   */
  namespace?: string;
  
  /**
   * Execution ID
   */
  executionId?: string;
}

/**
 * Workflow run options interface
 */
export interface WorkflowRunOptions {
  /**
   * Namespace
   */
  namespace?: string;
  
  /**
   * Execution ID
   */
  executionId?: string;
}

/**
 * Tool call options interface
 */
export interface ToolCallOptions {
  /**
   * Namespace
   */
  namespace?: string;
  
  /**
   * Execution ID
   */
  executionId?: string;
}

/**
 * Agent response interface
 */
export interface AgentResponse {
  /**
   * Execution ID
   */
  executionId: string;
  
  /**
   * Result
   */
  result?: any;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Agent name
   */
  agent: string;
  
  /**
   * Status
   */
  status: 'completed' | 'failed';
}

/**
 * Workflow response interface
 */
export interface WorkflowResponse {
  /**
   * Execution ID
   */
  executionId: string;
  
  /**
   * Result
   */
  result?: any;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Workflow name
   */
  workflow: string;
  
  /**
   * Status
   */
  status: 'completed' | 'failed';
}

/**
 * Tool response interface
 */
export interface ToolResponse {
  /**
   * Execution ID
   */
  executionId: string;
  
  /**
   * Result
   */
  result?: any;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Tool name
   */
  tool: string;
  
  /**
   * Status
   */
  status: 'completed' | 'failed';
}

/**
 * Run options interface
 */
export interface RunOptions {
  /**
   * File path
   */
  file?: string;
  
  /**
   * YAML content
   */
  content?: string;
  
  /**
   * Workflow name
   */
  workflow?: string;
  
  /**
   * Agent name
   */
  agent?: string;
  
  /**
   * Input content
   */
  input?: Record<string, any>;
  
  /**
   * Environment variables
   */
  env?: Record<string, string>;
} 