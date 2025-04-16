import { z } from 'zod';
import { RuntimeResource } from './resource';
import { Condition } from './common';

/**
 * Network配置Schema
 */
export const NetworkConfigSchema = z.object({
  instructions: z.string().optional(),
  agents: z.array(z.object({
    name: z.string(),
    ref: z.string()
  })),
  router: z.object({
    model: z.object({
      provider: z.string(),
      name: z.string()
    }),
    maxSteps: z.number().default(10)
  }),
  state: z.object({
    persistence: z.boolean().optional().default(false),
    ttl: z.number().optional()
  }).optional()
});

/**
 * Network配置类型
 */
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

/**
 * 声明式网络资源Schema
 */
export const NetworkResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Network'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional().default('default'),
    labels: z.record(z.string()).optional(),
    annotations: z.record(z.string()).optional(),
  }),
  spec: NetworkConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Failed']),
    conditions: z.array(z.lazy(() => z.any())).optional(),
    lastExecutionTime: z.string().optional(),
    stepCount: z.number().optional(),
    lastExecutionSummary: z.record(z.any()).optional(),
  }).optional(),
});

/**
 * 网络资源接口
 */
export interface NetworkResource extends RuntimeResource {
  apiVersion: string;
  kind: 'Network';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: NetworkConfig;
  status?: {
    phase: 'Pending' | 'Running' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
    stepCount?: number;
    lastExecutionSummary?: Record<string, any>;
  };
}

/**
 * 创建网络资源
 * @param name 网络名称
 * @param spec 网络配置
 * @param namespace 命名空间
 * @returns 网络资源对象
 */
export function createNetworkResource(
  name: string, 
  spec: NetworkConfig, 
  namespace: string = 'default'
): NetworkResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Network',
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

/**
 * 网络生成选项接口
 */
export interface NetworkGenerateOptions {
  sessionId?: string;
  history?: Array<{role: string, content: string}>;
  state?: Record<string, any>;
  systemPrompt?: string;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * 网络流式选项接口
 */
export interface NetworkStreamOptions extends NetworkGenerateOptions {
  onPartialResponse?: (partial: string) => void;
}

/**
 * 生成结果接口
 */
export interface GenerationResult {
  content: string;
  agentId: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

/**
 * 流式结果接口
 */
export interface StreamResult extends GenerationResult {
  isComplete: boolean;
} 