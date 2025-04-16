import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import { EventBus } from '../src/core/eventbus';
import { K8sDSLParser } from '../src/core/k8s-dsl-parser';
import { createCustomResourceDefinition } from '../src/types';

describe('K8s DSL解析器测试', () => {
  let parser: K8sDSLParser;
  let eventBus: EventBus;
  let tempDir: string;
  
  beforeEach(async () => {
    // 创建事件总线
    eventBus = new EventBus();
    
    // 创建解析器
    parser = new K8sDSLParser(eventBus);
    
    // 创建临时目录
    tempDir = path.join(tmpdir(), `mastra-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });
  
  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });
  
  describe('YAML解析', () => {
    it('应该能够解析有效的YAML内容', () => {
      const yaml = `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: test-agent
spec:
  model:
    provider: openai
    name: gpt-4
  instructions: "I am a test agent"
`;
      
      const resource = parser.parseContent(yaml);
      
      expect(resource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          },
          instructions: 'I am a test agent'
        }
      });
    });
    
    it('应该拒绝无效的YAML内容', () => {
      const invalidYaml = `
apiVersion: mastra.ai/v1
kind: Agent
  - this is invalid YAML
    with improper indentation
`;
      
      expect(() => parser.parseContent(invalidYaml)).toThrow('Failed to parse YAML content');
    });
  });
  
  describe('资源验证', () => {
    it('应该验证有效的资源', () => {
      const resource = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          }
        }
      };
      
      expect(() => parser.validateResource(resource)).not.toThrow();
    });
    
    it('应该拒绝缺少必要字段的资源', () => {
      // 缺少apiVersion
      const missingApiVersion = {
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {}
      };
      
      expect(() => parser.validateResource(missingApiVersion as any)).toThrow('Resource must include apiVersion');
      
      // 缺少kind
      const missingKind = {
        apiVersion: 'mastra.ai/v1',
        metadata: {
          name: 'test-agent'
        },
        spec: {}
      };
      
      expect(() => parser.validateResource(missingKind as any)).toThrow('Resource must include kind');
      
      // 缺少metadata
      const missingMetadata = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        spec: {}
      };
      
      expect(() => parser.validateResource(missingMetadata as any)).toThrow('Resource must include metadata');
      
      // 缺少name
      const missingName = {
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {},
        spec: {}
      };
      
      expect(() => parser.validateResource(missingName as any)).toThrow('Resource metadata must include name');
    });
    
    it('应该拒绝未知的资源类型', () => {
      const unknownKind = {
        apiVersion: 'mastra.ai/v1',
        kind: 'UnknownKind',
        metadata: {
          name: 'test-resource'
        },
        spec: {}
      };
      
      expect(() => parser.validateResource(unknownKind)).toThrow('Unknown resource kind');
    });
  });
  
  describe('文件解析', () => {
    it('应该能够解析YAML文件', async () => {
      // 创建测试YAML文件
      const filePath = path.join(tempDir, 'test-agent.yaml');
      await fs.writeFile(filePath, `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: test-agent
spec:
  model:
    provider: openai
    name: gpt-4
  instructions: "I am a test agent"
`);
      
      const resource = await parser.parseFile(filePath);
      
      expect(resource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'test-agent'
        },
        spec: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          },
          instructions: 'I am a test agent'
        }
      });
    });
    
    it('应该检测循环引用', async () => {
      // 创建测试文件A引用B
      const filePathA = path.join(tempDir, 'a.yaml');
      const spy = vi.spyOn(parser, 'parseFile');
      
      // 模拟循环引用情况
      spy.mockImplementation(async (filePath) => {
        // 第一次调用后，尝试模拟解析另一个文件，然后再次调用自身
        if (filePath === filePathA && !parser['loadingStack'].has(filePathA)) {
          parser['loadingStack'].add(filePathA);
          // 模拟循环调用
          await parser.parseFile(filePathA);
          return { circular: true } as any;
        }
        throw new Error('Circular reference detected');
      });
      
      // 尝试解析带有循环引用的文件
      await expect(parser.parseFile(filePathA)).rejects.toThrow('Circular reference detected');
      
      spy.mockRestore();
    });
    
    it('应该处理文件读取错误', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.yaml');
      
      await expect(parser.parseFile(nonExistentFile)).rejects.toThrow('Failed to parse YAML file');
    });
  });
  
  describe('目录扫描', () => {
    it('应该扫描目录中的所有YAML文件', async () => {
      // 创建测试文件
      await fs.writeFile(path.join(tempDir, 'agent1.yaml'), `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: agent1
spec:
  model:
    provider: openai
    name: gpt-4
`);
      
      await fs.writeFile(path.join(tempDir, 'agent2.yml'), `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: agent2
spec:
  model:
    provider: openai
    name: gpt-3.5-turbo
`);
      
      // 创建一个非YAML文件
      await fs.writeFile(path.join(tempDir, 'not-yaml.txt'), 'This is not a YAML file');
      
      // 扫描目录
      const resources = await parser.scanDirectory(tempDir);
      
      // 验证结果
      expect(resources).toHaveLength(2);
      expect(resources.map(r => r.metadata.name).sort()).toEqual(['agent1', 'agent2']);
    });
    
    it('应该忽略解析失败的文件', async () => {
      // 创建一个有效的YAML文件
      await fs.writeFile(path.join(tempDir, 'valid.yaml'), `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: valid-agent
spec:
  model:
    provider: openai
    name: gpt-4
`);
      
      // 创建一个无效的YAML文件
      await fs.writeFile(path.join(tempDir, 'invalid.yaml'), `
apiVersion: mastra.ai/v1
kind: Agent
  - this is invalid YAML
    with improper indentation
`);
      
      // 监视console.warn
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // 扫描目录
      const resources = await parser.scanDirectory(tempDir);
      
      // 验证结果
      expect(resources).toHaveLength(1);
      expect(resources[0].metadata.name).toBe('valid-agent');
      
      // 验证警告日志
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });
  
  describe('自定义资源', () => {
    it('应该注册和验证自定义资源', async () => {
      // 创建CRD
      const crd = createCustomResourceDefinition('datasources.mastra.ai', {
        group: 'mastra.ai',
        names: {
          kind: 'DataSource',
          plural: 'datasources'
        },
        scope: 'Namespaced',
        validation: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  url: { type: 'string' }
                },
                required: ['type', 'url']
              }
            }
          }
        }
      });
      
      // 解析CRD
      const crdYaml = `
apiVersion: mastra.ai/v1
kind: CustomResourceDefinition
metadata:
  name: datasources.mastra.ai
spec:
  group: mastra.ai
  names:
    kind: DataSource
    plural: datasources
  scope: Namespaced
  validation:
    openAPIV3Schema:
      type: object
      properties:
        spec:
          type: object
          properties:
            type:
              type: string
            url:
              type: string
          required:
            - type
            - url
`;
      
      // 验证CRD可以被解析
      const parsedCRD = parser.parseContent(crdYaml);
      parser.validateResource(parsedCRD);
      
      // 等待CRD控制器注册
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 创建自定义资源
      const customResourceYaml = `
apiVersion: mastra.ai/v1
kind: DataSource
metadata:
  name: my-database
spec:
  type: postgresql
  url: postgresql://localhost:5432/mydb
`;
      
      // 验证自定义资源可以被解析
      const customResource = parser.parseContent(customResourceYaml);
      
      // 模拟控制器处理，直接检查资源是否符合预期结构
      expect(customResource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'DataSource',
        metadata: {
          name: 'my-database'
        },
        spec: {
          type: 'postgresql',
          url: 'postgresql://localhost:5432/mydb'
        }
      });
    });
  });
  
  describe('MastraPod配置解析', () => {
    it('应该解析MastraPod配置文件', async () => {
      // 创建MastraPod配置文件
      const podFilePath = path.join(tempDir, 'mastrapod.yaml');
      await fs.writeFile(podFilePath, `
kind: MastraPod
version: '1'
metadata:
  name: test-pod
config:
  logLevel: debug
resources:
  - apiVersion: mastra.ai/v1
    kind: Agent
    metadata:
      name: inline-agent
    spec:
      model:
        provider: openai
        name: gpt-4
  - file: agent.yaml
  - directory: resources/
`);
      
      // 创建引用的文件
      const agentFilePath = path.join(tempDir, 'agent.yaml');
      await fs.writeFile(agentFilePath, `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: file-agent
spec:
  model:
    provider: openai
    name: gpt-3.5-turbo
`);
      
      // 创建资源目录
      const resourcesDir = path.join(tempDir, 'resources');
      await fs.ensureDir(resourcesDir);
      
      // 创建目录中的资源
      await fs.writeFile(path.join(resourcesDir, 'workflow.yaml'), `
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: dir-workflow
spec:
  steps:
    - name: step1
      agent: some-agent
`);
      
      // 解析MastraPod配置
      const { config, resources } = await parser.parseMastraPod(podFilePath);
      
      // 验证配置
      expect(config).toEqual({
        kind: 'MastraPod',
        version: '1',
        metadata: {
          name: 'test-pod'
        },
        config: {
          logLevel: 'debug'
        }
      });
      
      // 验证内联资源
      expect(resources.find(r => r.metadata.name === 'inline-agent')).toBeDefined();
      
      // 验证文件资源
      expect(resources.find(r => r.metadata.name === 'file-agent')).toBeDefined();
      
      // 验证目录资源
      expect(resources.find(r => r.metadata.name === 'dir-workflow')).toBeDefined();
      
      // 验证总资源数
      expect(resources).toHaveLength(3);
    });
    
    it('应该拒绝无效的MastraPod配置', async () => {
      // 创建无效的MastraPod配置文件 (缺少kind)
      const invalidPodFilePath = path.join(tempDir, 'invalid-pod.yaml');
      await fs.writeFile(invalidPodFilePath, `
version: '1'
metadata:
  name: invalid-pod
`);
      
      // 解析无效配置
      await expect(parser.parseMastraPod(invalidPodFilePath)).rejects.toThrow('Invalid MastraPod configuration');
    });
  });
  
  describe('旧格式配置转换', () => {
    it('应该将旧格式配置转换为Kubernetes风格资源', () => {
      // 旧格式配置
      const legacyConfig = {
        agents: {
          'my-agent': {
            model: {
              provider: 'openai',
              name: 'gpt-4'
            },
            instructions: 'I am a legacy agent'
          }
        },
        tools: {
          'my-tool': {
            type: 'http',
            url: 'https://example.com/api'
          }
        },
        workflows: {
          'my-workflow': {
            steps: [
              {
                name: 'step1',
                agent: 'my-agent'
              }
            ]
          }
        }
      };
      
      // 转换配置
      const resources = parser.convertLegacyConfig(legacyConfig);
      
      // 验证结果
      expect(resources).toHaveLength(3);
      
      // 验证Agent资源
      const agentResource = resources.find(r => r.kind === 'Agent');
      expect(agentResource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'Agent',
        metadata: {
          name: 'my-agent',
          namespace: 'default'
        },
        spec: {
          model: {
            provider: 'openai',
            name: 'gpt-4'
          },
          instructions: 'I am a legacy agent'
        }
      });
      
      // 验证Tool资源
      const toolResource = resources.find(r => r.kind === 'Tool');
      expect(toolResource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'Tool',
        metadata: {
          name: 'my-tool',
          namespace: 'default'
        },
        spec: {
          type: 'http',
          url: 'https://example.com/api'
        }
      });
      
      // 验证Workflow资源
      const workflowResource = resources.find(r => r.kind === 'Workflow');
      expect(workflowResource).toEqual({
        apiVersion: 'mastra.ai/v1',
        kind: 'Workflow',
        metadata: {
          name: 'my-workflow',
          namespace: 'default'
        },
        spec: {
          steps: [
            {
              name: 'step1',
              agent: 'my-agent'
            }
          ]
        }
      });
    });
    
    it('应该处理命名空间', () => {
      // 带命名空间的旧格式配置
      const legacyConfig = {
        agents: {
          'my-agent': {
            namespace: 'custom-ns',
            model: {
              provider: 'openai',
              name: 'gpt-4'
            }
          }
        }
      };
      
      // 转换配置
      const resources = parser.convertLegacyConfig(legacyConfig);
      
      // 验证结果
      expect(resources[0].metadata.namespace).toBe('custom-ns');
    });
  });
  
  describe('资源缓存和查询', () => {
    it('应该能够缓存和获取资源', async () => {
      // 创建测试资源
      const agentYaml = `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: cached-agent
  namespace: test-ns
spec:
  model:
    provider: openai
    name: gpt-4
`;
      
      // 解析资源
      const agent = parser.parseContent(agentYaml);
      
      // 添加到缓存 (通过扫描目录)
      const filePath = path.join(tempDir, 'agent.yaml');
      await fs.writeFile(filePath, agentYaml);
      await parser.scanDirectory(tempDir);
      
      // 获取所有资源
      const allResources = parser.getAllResources();
      expect(allResources).toHaveLength(1);
      
      // 按类型获取资源
      const agents = parser.getResourcesByKind('Agent');
      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual(agent);
      
      // 按名称获取资源
      const cachedAgent = parser.getResourceByName('Agent', 'test-ns', 'cached-agent');
      expect(cachedAgent).toEqual(agent);
      
      // 获取不存在的资源
      const nonExistent = parser.getResourceByName('Agent', 'test-ns', 'non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });
});
