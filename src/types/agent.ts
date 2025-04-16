import { z } from 'zod';
import { RuntimeResource } from './resource';
import { Condition } from './common';

/**
 * 智能体配置Schema
 */
export const AgentConfigSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  model: z.object({
    provider: z.string(),
    name: z.string(),
  }),
  tools: z.record(z.string()).optional(), // 工具引用路径
  memory: z.object({
    enabled: z.boolean().optional(),
    type: z.string().optional(),
    config: z.record(z.any()).optional(),
  }).optional(),
  voice: z.object({
    enabled: z.boolean().optional(),
    provider: z.string().optional(),
    config: z.record(z.any()).optional(),
  }).optional(),
});

/**
 * 声明式智能体资源Schema
 */
export const AgentResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Agent'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional().default('default'),
    labels: z.record(z.string()).optional(),
    annotations: z.record(z.string()).optional(),
  }),
  spec: AgentConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Failed']),
    conditions: z.array(z.lazy(() => z.any())).optional(),
    lastExecutionTime: z.string().optional(),
  }).optional(),
});

/**
 * 智能体配置类型
 */
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * 智能体资源接口
 */
export interface AgentResource extends RuntimeResource {
  apiVersion: string;
  kind: 'Agent';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: AgentConfig;
  status?: {
    phase: 'Pending' | 'Running' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
  };
}

/**
 * 创建智能体资源
 * @param name 智能体名称
 * @param spec 智能体配置
 * @param namespace 命名空间
 * @returns 智能体资源对象
 */
export function createAgentResource(
  name: string, 
  spec: AgentConfig, 
  namespace: string = 'default'
): AgentResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Agent',
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