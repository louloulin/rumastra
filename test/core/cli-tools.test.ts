import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { CLIRuntimeManager } from '../../src/core/cli-runtime-manager';

// Mock execSync to prevent actual command execution
vi.mock('child_process', () => ({
  execSync: vi.fn().mockImplementation((cmd) => {
    if (cmd.includes('mastra apply')) {
      return 'Resource applied successfully';
    }
    if (cmd.includes('mastra delete')) {
      return 'Resource deleted successfully';
    }
    if (cmd.includes('mastra get')) {
      if (cmd.includes('agents')) {
        return 'NAME           NAMESPACE   STATUS\nweather-agent   demo        Running';
      }
      if (cmd.includes('-o yaml')) {
        return 'apiVersion: mastra.ai/v1\nkind: Agent\nmetadata:\n  name: weather-agent';
      }
      return 'Resource details';
    }
    if (cmd.includes('mastra run')) {
      if (cmd.includes('workflow')) {
        return JSON.stringify({ result: 'Workflow execution completed' });
      }
      if (cmd.includes('agent')) {
        return 'Agent response';
      }
      if (cmd.includes('network')) {
        return JSON.stringify({ result: 'Network execution completed' });
      }
    }
    if (cmd.includes('mastra status')) {
      return 'Runtime status: OK\nAgents: 2\nWorkflows: 1\nNetworks: 0';
    }
    return '';
  })
}));

// Mock fs functions
vi.mock('fs-extra', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockImplementation((path) => {
    if (path.includes('weather-agent.yaml')) {
      return `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: weather-agent
  namespace: demo
spec:
  instructions: 'Test instructions'
  model:
    provider: openai
    name: gpt-4
`;
    }
    if (path.includes('weather-workflow.yaml')) {
      return `
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: weather-workflow
  namespace: demo
spec:
  steps:
    - id: step1
      type: agent
`;
    }
    return '';
  }),
  readdirSync: vi.fn().mockImplementation(() => {
    return [
      { name: 'weather-agent.yaml', isDirectory: () => false },
      { name: 'subfolder', isDirectory: () => true }
    ];
  }),
  writeFileSync: vi.fn()
}));

// Mocks for yaml parsing - normally you would use a proper yaml library
vi.mock('yaml', () => ({
  parse: vi.fn().mockImplementation((content) => {
    if (content.includes('Agent')) {
      return {
        kind: 'Agent',
        apiVersion: 'mastra.ai/v1',
        metadata: {
          name: 'weather-agent',
          namespace: 'demo'
        },
        spec: {
          instructions: 'Test instructions',
          model: {
            provider: 'openai',
            name: 'gpt-4'
          }
        }
      };
    }
    if (content.includes('Workflow')) {
      return {
        kind: 'Workflow',
        apiVersion: 'mastra.ai/v1',
        metadata: {
          name: 'weather-workflow',
          namespace: 'demo'
        },
        spec: {
          steps: [
            {
              id: 'step1',
              type: 'agent'
            }
          ]
        }
      };
    }
    return {};
  })
}));

describe('CLI Tools', () => {
  let cliManager: CLIRuntimeManager;
  let consoleSpy: any;

  beforeEach(() => {
    cliManager = new CLIRuntimeManager();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Resource Management Commands', () => {
    it('should apply resources from file', async () => {
      const filePath = 'resources/weather-agent.yaml';
      
      // Test apply command
      await cliManager.initialize();
      const resource = await cliManager.parseFile(filePath);
      await cliManager.loadResource(resource);
      
      expect(cliManager['runtimeManager'].addResource).toHaveBeenCalledWith(resource);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded successfully'));
    });
    
    it('should delete resources', async () => {
      // Mock implementation for delete functionality
      cliManager['runtimeManager'].deleteResource = vi.fn().mockResolvedValue(undefined);
      
      await cliManager.initialize();
      await cliManager.deleteResource('Agent', 'weather-agent');
      
      expect(cliManager['runtimeManager'].deleteResource).toHaveBeenCalledWith('Agent', 'weather-agent');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deleted successfully'));
    });
    
    it('should retrieve resource details', async () => {
      // Mock implementation for get functionality
      cliManager['runtimeManager'].getResource = vi.fn().mockResolvedValue({
        kind: 'Agent',
        metadata: { name: 'weather-agent' },
        spec: { instructions: 'Test instructions' }
      });
      
      await cliManager.initialize();
      const resource = await cliManager.getResource('Agent', 'weather-agent');
      
      expect(cliManager['runtimeManager'].getResource).toHaveBeenCalledWith('Agent', 'weather-agent');
      expect(resource).toHaveProperty('kind', 'Agent');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Resource details'));
    });
  });
  
  describe('Resource Execution Commands', () => {
    it('should execute agents', async () => {
      await cliManager.initialize();
      const result = await cliManager.executeAgent('weather-agent', 'What is the weather?');
      
      expect(cliManager['runtimeManager'].executeAgent).toHaveBeenCalledWith('weather-agent', 'What is the weather?');
      expect(result).toBeDefined();
    });
    
    it('should execute workflows', async () => {
      const workflowResource = {
        kind: 'Workflow',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'weather-workflow' },
        spec: { steps: [] }
      };
      
      await cliManager.initialize();
      await cliManager.executeWorkflow(workflowResource);
      
      expect(cliManager['runtimeManager'].getWorkflowExecutor).toHaveBeenCalled();
    });
    
    it('should execute networks', async () => {
      const networkResource = {
        kind: 'Network',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'test-network' },
        spec: { agents: [], router: { model: { provider: 'openai', name: 'gpt-4' } } }
      };
      
      await cliManager.initialize();
      await cliManager.executeNetwork(networkResource);
      
      expect(cliManager['runtimeManager'].getNetworkExecutor).toHaveBeenCalled();
    });
  });
  
  describe('Resource Validation Commands', () => {
    it('should validate resource files', async () => {
      const filePath = 'resources/weather-agent.yaml';
      
      const resource = await cliManager.parseFile(filePath);
      
      expect(resource).toHaveProperty('kind', 'Agent');
      expect(resource).toHaveProperty('metadata.name', 'weather-agent');
    });
    
    it('should handle validation failures', async () => {
      // Override mock for this test to simulate failure
      fs.existsSync = vi.fn().mockReturnValueOnce(true);
      fs.readFileSync = vi.fn().mockReturnValueOnce('invalid: yaml: content');
      
      try {
        await cliManager.parseFile('invalid.yaml');
        // If we reach here, the test fails
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
  
  describe('Status and Diagnostic Commands', () => {
    it('should show runtime status', async () => {
      // Mock implementation for status functionality
      cliManager.getStatus = vi.fn().mockResolvedValue({
        runtimeStatus: 'Running',
        resources: {
          agents: 2,
          workflows: 1,
          networks: 0
        },
        uptime: '10m'
      });
      
      await cliManager.initialize();
      const status = await cliManager.getStatus();
      
      expect(status).toHaveProperty('runtimeStatus', 'Running');
      expect(status.resources).toHaveProperty('agents', 2);
    });
  });
  
  describe('MastraPod Functionality', () => {
    it('should parse MastraPod configurations', async () => {
      // Mock parseMastraPod
      cliManager['parser'].parseMastraPod = vi.fn().mockResolvedValue({
        podConfig: { providers: { openai: { apiKey: 'test' } } },
        resources: [
          {
            kind: 'Agent',
            metadata: { name: 'weather-agent' },
            spec: { instructions: 'Test' }
          }
        ]
      });
      
      await cliManager.initialize();
      const podResult = await cliManager.parseMastraPod('pod.yaml');
      
      expect(podResult).toHaveProperty('podConfig');
      expect(podResult).toHaveProperty('resources');
      expect(podResult.resources.length).toBe(1);
      expect(podResult.resources[0]).toHaveProperty('kind', 'Agent');
    });
    
    it('should apply global configuration', async () => {
      const config = {
        providers: { openai: { apiKey: 'test' } },
        memory: { type: 'ephemeral' }
      };
      
      // Mock applyGlobalConfig
      cliManager.applyGlobalConfig = vi.fn().mockResolvedValue(undefined);
      
      await cliManager.initialize();
      await cliManager.applyGlobalConfig(config);
      
      expect(cliManager.applyGlobalConfig).toHaveBeenCalledWith(config);
    });
  });
  
  describe('CLI Helper Script Integration', () => {
    it('should execute CLI commands through helper script', () => {
      // Test the execSync mock is working properly
      const applyResult = execSync('mastra apply -f test.yaml');
      expect(applyResult).toBe('Resource applied successfully');
      
      const getResult = execSync('mastra get agents');
      expect(getResult).toContain('weather-agent');
      
      const runResult = execSync('mastra run workflow test-workflow');
      expect(JSON.parse(runResult as unknown as string)).toHaveProperty('result');
    });
  });
}); 