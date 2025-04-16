import { z } from 'zod';
import { RuntimeResource } from './resource';
import { Condition } from './common';

/**
 * 基础工具配置Schema
 */
export const ToolConfigSchema = z.object({
  id: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()).optional(),
  outputSchema: z.record(z.any()).optional(),
  execute: z.string(), // 执行函数的路径
});

/**
 * 声明式工具资源Schema
 */
export const ToolResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Tool'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional().default('default'),
    labels: z.record(z.string()).optional(),
    annotations: z.record(z.string()).optional(),
  }),
  spec: ToolConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Ready', 'Failed']),
    conditions: z.array(z.lazy(() => z.any())).optional(),
    lastExecutionTime: z.string().optional(),
  }).optional(),
});

/**
 * 工具配置类型
 */
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * 工具资源接口
 */
export interface ToolResource extends RuntimeResource {
  apiVersion: string;
  kind: 'Tool';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: ToolConfig;
  status?: {
    phase: 'Pending' | 'Ready' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
  };
}

/**
 * 创建工具资源
 * @param name 工具名称
 * @param spec 工具配置
 * @param namespace 命名空间
 * @returns 工具资源对象
 */
export function createToolResource(
  name: string, 
  spec: ToolConfig, 
  namespace: string = 'default'
): ToolResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Tool',
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