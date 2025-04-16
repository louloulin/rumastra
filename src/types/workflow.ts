import { z } from 'zod';
import { RuntimeResource } from './resource';
import { Condition } from './common';

/**
 * 工作流步骤Schema
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['agent', 'function', 'condition', 'parallel']).default('agent'),
  // 代理执行相关字段
  agent: z.string().optional(), // 旧版代理引用字段（为了向后兼容）
  agentId: z.string().optional(), // 新版代理引用字段
  // 函数执行相关字段
  function: z.any().optional(), // 函数引用
  // 条件执行相关字段
  condition: z.any().optional(), // 条件函数
  // 并行执行相关字段
  steps: z.array(z.lazy(() => WorkflowStepSchema)).optional(), // 并行步骤
  // 数据流
  input: z.record(z.any()).optional(),
  output: z.record(z.any()).optional(),
  // 控制流
  next: z.union([z.string(), z.array(z.string())]).optional(), // 旧版流转控制
  transitions: z.object({
    next: z.string().optional(),
    true: z.string().optional(), // 条件为真时的下一步
    false: z.string().optional(), // 条件为假时的下一步
  }).optional(), // 新版流转控制
  // 执行控制
  timeout: z.number().optional(), // 步骤超时时间(毫秒)
  retries: z.number().optional(), // 重试次数
  retryDelayMs: z.number().optional(), // 重试延迟(毫秒)
});

/**
 * 工作流配置Schema
 */
export const WorkflowConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
  initialStep: z.string(),
});

/**
 * 声明式工作流资源Schema
 */
export const WorkflowResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Workflow'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional().default('default'),
    labels: z.record(z.string()).optional(),
    annotations: z.record(z.string()).optional(),
  }),
  spec: WorkflowConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Completed', 'Failed']),
    conditions: z.array(z.lazy(() => z.any())).optional(),
    lastExecutionTime: z.string().optional(),
    currentStep: z.string().optional(),
  }).optional(),
});

/**
 * 工作流步骤类型
 */
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * 工作流配置类型
 */
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

/**
 * 工作流资源接口
 */
export interface WorkflowResource extends RuntimeResource {
  apiVersion: string;
  kind: 'Workflow';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: WorkflowConfig;
  status?: {
    phase: 'Pending' | 'Running' | 'Completed' | 'Failed';
    conditions?: Condition[];
    lastExecutionTime?: string;
    currentStep?: string;
  };
}

/**
 * 创建工作流资源
 * @param name 工作流名称
 * @param spec 工作流配置
 * @param namespace 命名空间
 * @returns 工作流资源对象
 */
export function createWorkflowResource(
  name: string, 
  spec: WorkflowConfig, 
  namespace: string = 'default'
): WorkflowResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Workflow',
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