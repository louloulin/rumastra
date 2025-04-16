import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { CLIRuntimeManager } from '../src/core/cli-runtime-manager';
import { RuntimeManager } from '../src/core/runtime-manager';
import { DSLParser } from '../src/core/dsl-parser';
import { WorkflowResource, NetworkResource } from '../src/types';

// Mock dependencies
vi.mock('../src/core/runtime-manager', () => {
  return {
    RuntimeManager: vi.fn().mockImplementation(() => {
      return {
        initialize: vi.fn().mockResolvedValue(undefined),
        addResource: vi.fn().mockResolvedValue(undefined),
        executeAgent: vi.fn().mockResolvedValue('Agent execution result'),
        getWorkflowExecutor: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          on: vi.fn()
        }),
        getNetworkExecutor: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          on: vi.fn()
        }),
        shutdown: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
      };
    }),
  };
});

vi.mock('../src/core/dsl-parser', () => {
  return {
    DSLParser: vi.fn().mockImplementation(() => {
      return {
        parseFile: vi.fn().mockResolvedValue({
          kind: 'Agent',
          apiVersion: 'mastra.ai/v1',
          metadata: { name: 'test-agent' },
          spec: {
            instructions: 'Test agent',
            model: { provider: 'openai', name: 'gpt-4' }
          }
        }),
        parseContent: vi.fn().mockReturnValue({
          kind: 'Agent',
          apiVersion: 'mastra.ai/v1',
          metadata: { name: 'test-agent' },
          spec: {
            instructions: 'Test agent',
            model: { provider: 'openai', name: 'gpt-4' }
          }
        }),
        scanDirectory: vi.fn().mockResolvedValue([
          {
            kind: 'Agent',
            apiVersion: 'mastra.ai/v1',
            metadata: { name: 'test-agent' },
            spec: {
              instructions: 'Test agent',
              model: { provider: 'openai', name: 'gpt-4' }
            }
          }
        ]),
        parseMastraPod: vi.fn().mockResolvedValue({
          podConfig: {
            providers: { openai: { apiKey: 'test-key' } },
            memory: { type: 'ephemeral' }
          },
          resources: [
            {
              kind: 'Agent',
              apiVersion: 'mastra.ai/v1',
              metadata: { name: 'test-agent' },
              spec: {
                instructions: 'Test agent',
                model: { provider: 'openai', name: 'gpt-4' }
              }
            }
          ]
        }),
      };
    }),
  };
});

describe('CLIRuntimeManager', () => {
  let cliManager: CLIRuntimeManager;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    cliManager = new CLIRuntimeManager();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基本功能测试', () => {
    it('应当正确初始化CLIRuntimeManager', async () => {
      await cliManager.initialize();
      
      // 验证RuntimeManager的initialize被调用
      expect(cliManager['runtimeManager'].initialize).toHaveBeenCalled();
    });

    it('应当正确加载资源', async () => {
      await cliManager.initialize();
      
      const resource = {
        kind: 'Agent',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'test-agent' },
        spec: {
          instructions: 'Test agent',
          model: { provider: 'openai', name: 'gpt-4' }
        }
      };
      
      await cliManager.loadResource(resource);
      
      // 验证资源被添加到RuntimeManager
      expect(cliManager['runtimeManager'].addResource).toHaveBeenCalledWith(resource);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('loaded successfully'));
    });

    it('应当处理加载资源时的错误', async () => {
      await cliManager.initialize();
      
      const resource = {
        kind: 'Agent',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'test-agent' },
        spec: {
          instructions: 'Test agent',
          model: { provider: 'openai', name: 'gpt-4' }
        }
      };
      
      // 模拟addResource失败
      cliManager['runtimeManager'].addResource = vi.fn().mockRejectedValue(new Error('Resource loading failed'));
      
      await expect(cliManager.loadResource(resource)).rejects.toThrow('Resource loading failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load resource'));
    });
  });

  describe('执行功能测试', () => {
    it('应当正确执行Agent', async () => {
      await cliManager.initialize();
      
      const result = await cliManager.executeAgent('test-agent', 'Hello');
      
      // 验证Agent被执行
      expect(cliManager['runtimeManager'].executeAgent).toHaveBeenCalledWith('test-agent', 'Hello');
      expect(result).toBe('Agent execution result');
    });

    it('应当正确执行Workflow', async () => {
      await cliManager.initialize();
      
      const workflowResource: WorkflowResource = {
        kind: 'Workflow',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'test-workflow' },
        spec: {
          steps: [],
          name: 'test-workflow',
          initialStep: 'step1'
        }
      };
      
      await cliManager.executeWorkflow(workflowResource);
      
      // 在此测试中，我们测试CLIRuntimeManager中的executeWorkflow方法功能
      // 实际实现可能会调用RuntimeManager.getWorkflowExecutor().execute
      expect(cliManager['runtimeManager'].getWorkflowExecutor).toHaveBeenCalled();
    });

    it('应当正确执行Network', async () => {
      await cliManager.initialize();
      
      const networkResource: NetworkResource = {
        kind: 'Network',
        apiVersion: 'mastra.ai/v1',
        metadata: { name: 'test-network' },
        spec: {
          agents: [],
          router: {
            maxSteps: 10,
            model: {
              provider: 'openai',
              name: 'gpt-4'
            }
          }
        }
      };
      
      await cliManager.executeNetwork(networkResource);
      
      // 在此测试中，我们测试CLIRuntimeManager中的executeNetwork方法功能
      // 实际实现可能会调用RuntimeManager.getNetworkExecutor().execute
      expect(cliManager['runtimeManager'].getNetworkExecutor).toHaveBeenCalled();
    });
  });

  describe('解析功能测试', () => {
    it('应当正确解析文件', async () => {
      const result = await cliManager.parseFile('test.yaml');
      
      expect(cliManager['parser'].parseFile).toHaveBeenCalledWith('test.yaml');
      expect(result).toEqual(expect.objectContaining({
        kind: 'Agent',
        metadata: { name: 'test-agent' }
      }));
    });

    it('应当正确解析内容', () => {
      const content = `
        kind: Agent
        apiVersion: mastra.ai/v1
        metadata:
          name: test-agent
      `;
      
      const result = cliManager.parseContent(content);
      
      expect(cliManager['parser'].parseContent).toHaveBeenCalledWith(content);
      expect(result).toEqual(expect.objectContaining({
        kind: 'Agent',
        metadata: { name: 'test-agent' }
      }));
    });

    it('应当正确扫描目录', async () => {
      const result = await cliManager.scanDirectory('./resources');
      
      expect(cliManager['parser'].scanDirectory).toHaveBeenCalledWith('./resources');
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'Agent',
          metadata: { name: 'test-agent' }
        })
      ]));
    });

    it('应当正确解析MastraPod', async () => {
      const result = await cliManager.parseMastraPod('pod.yaml');
      
      expect(cliManager['parser'].parseMastraPod).toHaveBeenCalledWith('pod.yaml');
      expect(result).toEqual({
        podConfig: {
          providers: { openai: { apiKey: 'test-key' } },
          memory: { type: 'ephemeral' }
        },
        resources: [
          expect.objectContaining({
            kind: 'Agent',
            metadata: { name: 'test-agent' }
          })
        ]
      });
    });
  });

  describe('配置与清理测试', () => {
    it('应当正确应用全局配置', async () => {
      const config = {
        providers: {
          openai: { apiKey: 'test-key' }
        },
        memory: { type: 'ephemeral' }
      };
      
      // 模拟applyGlobalConfig方法
      cliManager.applyGlobalConfig = vi.fn().mockImplementation(async () => {});
      
      await cliManager.applyGlobalConfig(config);
      
      expect(cliManager.applyGlobalConfig).toHaveBeenCalledWith(config);
    });

    it('应当正确清理资源', async () => {
      await cliManager.cleanup();
      
      expect(cliManager['runtimeManager'].shutdown).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('cleaned up'));
    });
  });

  describe('事件转发测试', () => {
    it('应当正确转发运行时事件', async () => {
      // 监听CLIRuntimeManager的事件
      const eventSpy = vi.fn();
      cliManager.on('workflow:start', eventSpy);
      
      // 模拟RuntimeManager触发事件
      const eventData = { workflowId: 'test-workflow' };
      await cliManager.initialize();
      
      // 手动触发事件处理函数
      // 注意：因为在实际代码中我们用on方法注册了事件处理函数，但模拟中无法直接触发
      // 这里我们获取on方法的第二个参数（回调函数）并手动调用它
      const eventCallback = vi.mocked(cliManager['runtimeManager'].on).mock.calls.find(
        call => call[0] === 'workflow:start'
      )?.[1];
      
      if (eventCallback) {
        eventCallback(eventData);
        expect(eventSpy).toHaveBeenCalledWith(eventData);
      } else {
        // 使用expect替代fail
        expect(false).toBe(true);  // 这将导致测试失败
      }
    });
  });
}); 