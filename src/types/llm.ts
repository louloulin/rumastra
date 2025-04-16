import { z } from 'zod';
import { RuntimeResource } from './resource';
import { Condition } from './common';

/**
 * LLM配置Schema
 */
export const LLMConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  options: z.record(z.any()).optional(),
});

/**
 * LLM配置类型
 */
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * LLM资源接口
 */
export interface LLMResource extends RuntimeResource {
  apiVersion: string;
  kind: 'LLM';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: LLMConfig;
  status?: {
    phase: 'Pending' | 'Ready' | 'Failed';
    conditions?: Condition[];
    lastProbeTime?: string;
    providerInfo?: {
      type?: string;
      version?: string;
    };
  };
}

/**
 * 创建LLM资源
 * @param name LLM名称
 * @param spec LLM配置
 * @param namespace 命名空间
 * @returns LLM资源对象
 */
export function createLLMResource(
  name: string, 
  spec: LLMConfig, 
  namespace: string = 'default'
): LLMResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'LLM',
    metadata: {
      name,
      namespace,
    },
    spec,
    status: {
      phase: 'Pending',
      conditions: []
    }
  };
} 