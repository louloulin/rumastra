import { z } from 'zod';

/**
 * 资源元数据Schema
 */
export const MetadataSchema = z.object({
  name: z.string(),
  namespace: z.string().optional().default('default'),
  labels: z.record(z.string()).optional(),
  annotations: z.record(z.string()).optional(),
  deletionTimestamp: z.string().datetime().optional(), // 删除时间戳
});

/**
 * 条件状态Schema
 */
export const ConditionSchema = z.object({
  type: z.string(),
  status: z.enum(['True', 'False', 'Unknown']),
  reason: z.string().optional(),
  message: z.string().optional(),
  lastTransitionTime: z.string().optional(),
});

/**
 * 元数据类型
 */
export type Metadata = z.infer<typeof MetadataSchema>;

/**
 * 条件类型
 */
export type Condition = z.infer<typeof ConditionSchema>;

/**
 * 解析环境变量引用
 * @param obj 需要处理环境变量的对象
 * @returns 处理后的对象
 */
export function resolveEnvVariables(obj: any): any {
  // 如果是字符串，尝试解析环境变量
  if (typeof obj === 'string') {
    return resolveEnvString(obj);
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map(item => resolveEnvVariables(item));
  }

  // 如果是对象，递归处理每个属性
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = resolveEnvVariables(obj[key]);
      }
    }
    return result;
  }

  // 其他类型直接返回
  return obj;
}

/**
 * 解析字符串中的环境变量引用
 * @param str 包含环境变量引用的字符串
 * @returns 解析后的字符串
 */
function resolveEnvString(str: string): string {
  // 匹配${ENV_VAR}格式的环境变量引用
  return str.replace(/\${([^}]+)}/g, (match, envVarName) => {
    const envValue = process.env[envVarName];
    return envValue !== undefined ? envValue : match;
  });
} 