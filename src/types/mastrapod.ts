import { z } from 'zod';
import { RuntimeResource } from './resource';
import { MetadataSchema } from './common';

/**
 * MastraPod Schema
 */
export const MastraPodSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('MastraPod'),
  metadata: MetadataSchema,
  spec: z.object({
    description: z.string().optional(),
    agents: z.array(z.any()).optional(),
    tools: z.array(z.any()).optional(),
    workflows: z.array(z.any()).optional(),
    networks: z.array(z.any()).optional(),
    providers: z.record(z.any()).optional(),
    memory: z.record(z.any()).optional()
  })
});

/**
 * MastraPod类型
 */
export type MastraPod = z.infer<typeof MastraPodSchema>;

/**
 * 创建MastraPod资源
 * @param name Pod名称
 * @param spec Pod配置
 * @param namespace 命名空间
 * @returns MastraPod资源对象
 */
export function createMastraPodResource(
  name: string, 
  spec: any, 
  namespace: string = 'default'
): MastraPod {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'MastraPod',
    metadata: {
      name,
      namespace,
    },
    spec
  };
}

/**
 * MastraPod选项接口
 */
export interface MastraPodOptions {
  /**
   * 环境变量映射，用于解析环境变量引用
   */
  env?: Record<string, string>;
}

/**
 * MastraPod加载选项接口
 */
export interface MastraPodLoadOptions extends MastraPodOptions {
  /**
   * 是否验证资源
   */
  validate?: boolean;
}

/**
 * 代理运行选项接口
 */
export interface AgentRunOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}

/**
 * 工作流运行选项接口
 */
export interface WorkflowRunOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}

/**
 * 工具调用选项接口
 */
export interface ToolCallOptions {
  /**
   * 命名空间
   */
  namespace?: string;
  
  /**
   * 执行ID
   */
  executionId?: string;
}

/**
 * 代理响应接口
 */
export interface AgentResponse {
  /**
   * 执行ID
   */
  executionId: string;
  
  /**
   * 结果
   */
  result?: any;
  
  /**
   * 错误消息
   */
  error?: string;
  
  /**
   * 代理名称
   */
  agent: string;
  
  /**
   * 状态
   */
  status: 'completed' | 'failed';
}

/**
 * 工作流响应接口
 */
export interface WorkflowResponse {
  /**
   * 执行ID
   */
  executionId: string;
  
  /**
   * 结果
   */
  result?: any;
  
  /**
   * 错误消息
   */
  error?: string;
  
  /**
   * 工作流名称
   */
  workflow: string;
  
  /**
   * 状态
   */
  status: 'completed' | 'failed';
}

/**
 * 工具响应接口
 */
export interface ToolResponse {
  /**
   * 执行ID
   */
  executionId: string;
  
  /**
   * 结果
   */
  result?: any;
  
  /**
   * 错误消息
   */
  error?: string;
  
  /**
   * 工具名称
   */
  tool: string;
  
  /**
   * 状态
   */
  status: 'completed' | 'failed';
}

/**
 * 运行选项接口
 */
export interface RunOptions {
  /**
   * 文件路径
   */
  file?: string;
  
  /**
   * YAML内容
   */
  content?: string;
  
  /**
   * 工作流名称
   */
  workflow?: string;
  
  /**
   * 代理名称
   */
  agent?: string;
  
  /**
   * 输入内容
   */
  input?: Record<string, any>;
  
  /**
   * 环境变量
   */
  env?: Record<string, string>;
} 