import { z } from 'zod';
import { ToolConfigSchema } from './tool';
import { AgentConfigSchema } from './agent';
import { WorkflowConfigSchema } from './workflow';

/**
 * 根配置Schema
 */
export const RootConfigSchema = z.object({
  version: z.string(),
  tools: z.record(ToolConfigSchema).optional(),
  agents: z.record(AgentConfigSchema),
  workflows: z.record(WorkflowConfigSchema).optional(),
  providers: z.record(z.any()).optional(),
  memory: z.record(z.any()).optional(),
});

/**
 * 根配置类型
 */
export type RootConfig = z.infer<typeof RootConfigSchema>;

/**
 * 验证根配置
 * @param config 需要验证的配置对象
 * @returns 验证后的配置对象
 */
export function validateRootConfig(config: any): RootConfig {
  try {
    // 使用Zod验证配置
    return RootConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 格式化错误信息
      const formattedErrors = error.errors.map(err => {
        return `${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      
      throw new Error(`Configuration validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
} 