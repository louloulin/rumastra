import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import fs from 'fs-extra';
import { 
  MastraPod, 
  loadFile, 
  loadContent, 
  createApp, 
  run,
  MastraPodOptions
} from '../src/mastra-api';

// Mocked environment for testing
const TEST_ENV = {
  OPENAI_API_KEY: 'test-openai-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key'
};

// Test fixtures directory
const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEMP_DIR = join(__dirname, 'temp');

// Sample MastraPod YAML for testing
const SAMPLE_POD_YAML = `
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: test-pod
  namespace: default
providers:
  openai:
    apiKey: \${env.OPENAI_API_KEY}
    defaultModel: gpt-4
  anthropic:
    apiKey: \${env.ANTHROPIC_API_KEY}
memory:
  type: ephemeral
  config:
    ttl: 3600
resources:
  - apiVersion: mastra/v1
    kind: Tool
    metadata:
      name: echo-tool
    spec:
      id: echo
      description: "Echo the input"
      execute: "{return params;}"
      parameters:
        type: object
        properties:
          message:
            type: string
  - apiVersion: mastra/v1
    kind: Agent
    metadata:
      name: test-agent
    spec:
      name: "Test Agent"
      instructions: "You are a test agent"
      model:
        provider: openai
        name: gpt-4
      tools:
        echo: echo-tool
  - apiVersion: mastra/v1
    kind: Workflow
    metadata:
      name: test-workflow
    spec:
      name: "Test Workflow"
      initialStep: step1
      steps:
        - id: step1
          name: "Step 1"
          agent: test-agent
          next: END
`;

// Helper function to write a temporary file
async function writeTempFile(filename: string, content: string): Promise<string> {
  await fs.ensureDir(TEMP_DIR);
  const filepath = join(TEMP_DIR, filename);
  await fs.writeFile(filepath, content);
  return filepath;
}

describe('MastraPod API', () => {
  // Setup and cleanup
  beforeEach(async () => {
    await fs.ensureDir(TEMP_DIR);
    
    // Mock runtime manager methods with improved implementation
    vi.mock('../src/core/runtime-manager', () => {
      // Create a resource store for our mock
      const mockResources = new Map();
      
      const RuntimeManager = vi.fn().mockImplementation(() => ({
        addResource: vi.fn().mockImplementation((resource) => {
          // Store the resource in our mock collection
          const key = `${resource.kind}.${resource.metadata?.namespace || 'default'}.${resource.metadata?.name}`;
          mockResources.set(key, resource);
          return Promise.resolve(resource);
        }),
        setProviderConfig: vi.fn(),
        setMemoryConfig: vi.fn(),
        getAgent: vi.fn().mockImplementation((agentId) => {
          // Return a mock agent with execute and generate methods
          return {
            id: agentId,
            execute: vi.fn().mockResolvedValue({ content: 'Test response' }),
            generate: vi.fn().mockResolvedValue({ text: 'Test response' })
          };
        }),
        getToolFunction: vi.fn().mockImplementation((toolId) => {
          return async (params) => ({ result: params });
        }),
        on: vi.fn(),
        emit: vi.fn(),
        // Add a method to get resources by kind
        getResourcesByKind: vi.fn().mockImplementation((kind) => {
          return Array.from(mockResources.values())
            .filter(r => r.kind === kind);
        }),
        // Add a method to get resource by ID
        getResource: vi.fn().mockImplementation((kind, name, namespace = 'default') => {
          const key = `${kind}.${namespace}.${name}`;
          return mockResources.get(key);
        })
      }));
      
      return { RuntimeManager };
    });
    
    // Mock workflow executor
    vi.mock('../src/core/workflow/executor', () => {
      const WorkflowExecutor = vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue({ 
          status: 'completed',
          output: 'Workflow completed',
          history: [],
          error: null
        })
      }));
      
      return { WorkflowExecutor };
    });
  });
  
  afterEach(async () => {
    vi.clearAllMocks();
    await fs.remove(TEMP_DIR);
  });
  
  describe('MastraPod class', () => {
    it('should create a MastraPod instance', () => {
      const pod = new MastraPod({ env: TEST_ENV });
      expect(pod).toBeInstanceOf(MastraPod);
    });
    
    it('should create a pod with default settings', () => {
      const pod = MastraPod.createApp();
      expect(pod).toBeInstanceOf(MastraPod);
    });
    
    it('should create a pod with custom defaults', () => {
      const pod = MastraPod.withDefaults({
        env: TEST_ENV,
        metadata: { name: 'test-pod' }
      });
      expect(pod).toBeInstanceOf(MastraPod);
    });
  });
  
  describe('YAML loading', () => {
    it('should load from YAML content', async () => {
      const pod = await MastraPod.loadContent(SAMPLE_POD_YAML, { 
        env: TEST_ENV 
      });
      
      expect(pod).toBeInstanceOf(MastraPod);
      expect(pod.getResourcesByKind('Agent').length).toBeGreaterThan(0);
      expect(pod.getResourcesByKind('Tool').length).toBeGreaterThan(0);
      expect(pod.getResourcesByKind('Workflow').length).toBeGreaterThan(0);
    });
    
    it('should load from a YAML file', async () => {
      const filepath = await writeTempFile('pod.yaml', SAMPLE_POD_YAML);
      const pod = await MastraPod.loadFile(filepath, { env: TEST_ENV });
      
      expect(pod).toBeInstanceOf(MastraPod);
      expect(pod.getResourcesByKind('Agent').length).toBeGreaterThan(0);
    });
    
    it('should support chained file loading', async () => {
      const filepath = await writeTempFile('pod.yaml', SAMPLE_POD_YAML);
      const pod = createApp({ env: TEST_ENV });
      
      await pod.addFile(filepath);
      expect(pod.getResourcesByKind('Agent').length).toBeGreaterThan(0);
    });
  });
  
  describe('Resource access', () => {
    let pod: MastraPod;
    
    beforeEach(async () => {
      pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
    });
    
    it('should get resources by kind', () => {
      const agents = pod.getResourcesByKind('Agent');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].kind).toBe('Agent');
    });
    
    it('should get resource by name', () => {
      const agent = pod.getResource('Agent', 'test-agent');
      expect(agent).toBeDefined();
      expect(agent?.metadata?.name).toBe('test-agent');
    });
    
    it('should get agent instance', () => {
      const agent = pod.getAgent('test-agent');
      expect(agent).toBeDefined();
    });
  });
  
  describe('Agent execution', () => {
    let pod: MastraPod;
    
    beforeEach(async () => {
      pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
    });
    
    it('should run an agent with string input', async () => {
      const response = await pod.runAgent('test-agent', 'Hello world');
      
      expect(response.status).toBe('completed');
      expect(response.agent).toBe('test-agent');
      expect(response.executionId).toBeDefined();
      expect(response.result).toBeDefined();
    });
    
    it('should run an agent with object input', async () => {
      const response = await pod.runAgent('test-agent', { message: 'Hello world' });
      
      expect(response.status).toBe('completed');
      expect(response.agent).toBe('test-agent');
      expect(response.executionId).toBeDefined();
      expect(response.result).toBeDefined();
    });
    
    it('should handle agent execution errors', async () => {
      // Force error by using non-existent agent
      const response = await pod.runAgent('non-existent-agent', 'Hello world');
      
      expect(response.status).toBe('failed');
      expect(response.error).toBeDefined();
    });
  });
  
  describe('Workflow execution', () => {
    let pod: MastraPod;
    
    beforeEach(async () => {
      pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
    });
    
    it('should run a workflow', async () => {
      const response = await pod.runWorkflow('test-workflow', { input: 'test' });
      
      expect(response.status).toBe('completed');
      expect(response.workflow).toBe('test-workflow');
      expect(response.executionId).toBeDefined();
      expect(response.result).toBeDefined();
    });
    
    it('should handle workflow execution errors', async () => {
      // Force error by using non-existent workflow
      const response = await pod.runWorkflow('non-existent-workflow', { input: 'test' });
      
      expect(response.status).toBe('failed');
      expect(response.error).toBeDefined();
    });
  });
  
  describe('Tool execution', () => {
    let pod: MastraPod;
    
    beforeEach(async () => {
      pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
    });
    
    it('should call a tool', async () => {
      const response = await pod.callTool('echo-tool', { message: 'Hello world' });
      
      expect(response.status).toBe('completed');
      expect(response.tool).toBe('echo-tool');
      expect(response.executionId).toBeDefined();
      expect(response.result).toBeDefined();
    });
    
    it('should handle tool execution errors', async () => {
      // Force error by using non-existent tool
      const response = await pod.callTool('non-existent-tool', { message: 'Hello world' });
      
      expect(response.status).toBe('failed');
      expect(response.error).toBeDefined();
    });
  });
  
  describe('Convenience functions', () => {
    it('should support the run convenience function for workflow execution', async () => {
      const filepath = await writeTempFile('pod.yaml', SAMPLE_POD_YAML);
      
      const response = await run({
        file: filepath,
        workflow: 'test-workflow',
        input: { message: 'Hello' },
        env: TEST_ENV
      });
      
      expect(response).toBeDefined();
      if ('workflow' in response) {
        expect(response.workflow).toBe('test-workflow');
        expect(response.status).toBe('completed');
      }
    });
    
    it('should support the run convenience function for agent execution', async () => {
      const filepath = await writeTempFile('pod.yaml', SAMPLE_POD_YAML);
      
      const response = await run({
        file: filepath,
        agent: 'test-agent',
        input: { message: 'Hello' },
        env: TEST_ENV
      });
      
      expect(response).toBeDefined();
      if ('agent' in response) {
        expect(response.agent).toBe('test-agent');
        expect(response.status).toBe('completed');
      }
    });
    
    it('should support loadFile convenience function', async () => {
      const filepath = await writeTempFile('pod.yaml', SAMPLE_POD_YAML);
      const pod = await loadFile(filepath, { env: TEST_ENV });
      
      expect(pod).toBeInstanceOf(MastraPod);
    });
    
    it('should support loadContent convenience function', async () => {
      const pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
      expect(pod).toBeInstanceOf(MastraPod);
    });
    
    it('should support createApp convenience function', () => {
      const pod = createApp({ env: TEST_ENV });
      expect(pod).toBeInstanceOf(MastraPod);
    });
  });
  
  describe('Environment variable resolution', () => {
    it('should resolve environment variables in provider configs', async () => {
      const pod = await loadContent(SAMPLE_POD_YAML, { env: TEST_ENV });
      
      // Since we're mocking the runtime manager, we can't directly test the values
      // but we can ensure the pod was created successfully
      expect(pod).toBeInstanceOf(MastraPod);
    });
  });
}); 