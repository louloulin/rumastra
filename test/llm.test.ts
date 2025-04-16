import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeManager } from '../src';
import { createLLMResource, LLMConfig } from '../src/types';
import { yamlToMastraLLM } from '../src/core/llm/converter';

vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Mock OpenAI response' } }]
            })
          }
        }
      };
    })
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ text: 'Mock Anthropic response' }]
          })
        }
      };
    })
  };
});

// 模拟环境变量
process.env.OPENAI_API_KEY = 'mock-openai-key';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';

describe('LLM功能测试', () => {
  let runtimeManager: RuntimeManager;

  beforeEach(() => {
    // 创建运行时管理器
    runtimeManager = new RuntimeManager();
  });

  describe('LLM资源管理', () => {
    it('应该能够创建和管理LLM资源', async () => {
      // 创建LLM配置
      const llmConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        options: {
          temperature: 0.7,
          maxTokens: 2000
        }
      };
      
      // 创建LLM资源
      const llmResource = createLLMResource('test-llm', llmConfig);
      
      // 添加到运行时
      await runtimeManager.addResource(llmResource);
      
      // 获取LLM模型 (通过运行时管理器)
      const llmId = 'default.test-llm';
      const llmModel = runtimeManager.getLLM(llmId);
      
      // 验证模型信息
      expect(llmModel).toBeDefined();
      expect(llmModel.provider).toBe('openai');
      expect(llmModel.model).toBe('gpt-4o');
      expect(llmModel.client).toBeDefined();
    });
    
    it('应该支持从环境变量获取API密钥', async () => {
      // 创建使用环境变量的LLM资源
      const llmResource = createLLMResource('env-api-llm', {
        provider: 'anthropic',
        model: 'claude-3-opus'
      });
      
      // 添加到运行时
      await runtimeManager.addResource(llmResource);
      
      // 获取LLM模型
      const llmId = 'default.env-api-llm';
      const llmModel = runtimeManager.getLLM(llmId);
      
      // 验证模型信息
      expect(llmModel).toBeDefined();
      expect(llmModel.provider).toBe('anthropic');
      expect(llmModel.model).toBe('claude-3-opus');
      expect(llmModel.client).toBeDefined();
      
      // 验证API密钥从环境变量中获取
      expect(llmModel.config.apiKey).toBe('mock-anthropic-key');
    });
    
    it('应该抛出错误当获取不存在的LLM', () => {
      // 尝试获取不存在的LLM
      expect(() => {
        runtimeManager.getLLM('nonexistent.llm');
      }).toThrow('LLM not found');
    });
  });
  
  describe('YAML转LLM功能', () => {
    it('应该能够将YAML转换为LLM模型', async () => {
      // 创建YAML
      const yamlContent = `
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: yaml-llm
  namespace: default
spec:
  provider: openai
  model: gpt-4o
  options:
    temperature: 0.8
`;
      
      // 转换YAML为LLM模型
      const model = await yamlToMastraLLM(yamlContent);
      
      // 验证模型
      expect(model).toBeDefined();
      expect(model.provider).toBe('openai');
      expect(model.model).toBe('gpt-4o');
      expect(model.client).toBeDefined();
    });
    
    it('应该拒绝无效的YAML格式', async () => {
      // 创建无效YAML - 缺少provider
      const invalidYaml = `
apiVersion: mastra.ai/v1
kind: LLM
metadata:
  name: invalid-llm
spec:
  model: gpt-4
`;
      
      // 尝试转换
      await expect(yamlToMastraLLM(invalidYaml)).rejects.toThrow();
    });
    
    it('应该拒绝非LLM资源的YAML', async () => {
      // 创建非LLM YAML
      const nonLLMYaml = `
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: test-agent
spec:
  instructions: "测试指令"
`;
      
      // 尝试转换
      await expect(yamlToMastraLLM(nonLLMYaml)).rejects.toThrow('Invalid resource kind');
    });
  });
}); 