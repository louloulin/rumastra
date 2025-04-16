import { z } from 'zod';

/**
 * 定义 Runtime 核心 API - K8s风格的资源定义
 */
export interface RuntimeResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    deletionTimestamp?: string; // 标记资源被删除的时间戳
  };
  spec: unknown;
  status?: unknown;
}

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

// 基础工具配置
export const ToolConfigSchema = z.object({
  id: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()).optional(),
  outputSchema: z.record(z.any()).optional(),
  execute: z.string(), // 执行函数的路径
});

// 智能体配置
export const AgentConfigSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  model: z.object({
    provider: z.string(),
    name: z.string(),
  }),
  tools: z.record(z.string()).optional(), // 工具引用路径
  memory: z
    .object({
      enabled: z.boolean().optional(),
      type: z.string().optional(),
      config: z.record(z.any()).optional(),
    })
    .optional(),
  voice: z
    .object({
      enabled: z.boolean().optional(),
      provider: z.string().optional(),
      config: z.record(z.any()).optional(),
    })
    .optional(),
});

// 工作流步骤配置
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

// 工作流配置
export const WorkflowConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
  initialStep: z.string(),
});

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
 * 声明式工具资源Schema
 */
export const ToolResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Tool'),
  metadata: MetadataSchema,
  spec: ToolConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Ready', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    lastExecutionTime: z.string().optional(),
  }).optional(),
});

/**
 * 声明式智能体资源Schema
 */
export const AgentResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Agent'),
  metadata: MetadataSchema,
  spec: AgentConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    lastExecutionTime: z.string().optional(),
  }).optional(),
});

/**
 * 声明式工作流资源Schema
 */
export const WorkflowResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Workflow'),
  metadata: MetadataSchema,
  spec: WorkflowConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Completed', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    lastExecutionTime: z.string().optional(),
    currentStep: z.string().optional(),
  }).optional(),
});

/**
 * 声明式网络资源Schema
 */
export const NetworkResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Network'),
  metadata: MetadataSchema,
  spec: NetworkConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Running', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    lastExecutionTime: z.string().optional(),
    stepCount: z.number().optional(),
    lastExecutionSummary: z.record(z.any()).optional(),
  }).optional(),
});

// 根配置
export const RootConfigSchema = z.object({
  version: z.string(),
  tools: z.record(ToolConfigSchema).optional(),
  agents: z.record(AgentConfigSchema),
  workflows: z.record(WorkflowConfigSchema).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type RootConfig = z.infer<typeof RootConfigSchema>;

export type Metadata = z.infer<typeof MetadataSchema>;
export type Condition = z.infer<typeof ConditionSchema>;

/**
 * Tool资源类型 - 确保满足RuntimeResource接口要求
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
 * Agent资源类型 - 确保满足RuntimeResource接口要求
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
 * Workflow资源类型 - 确保满足RuntimeResource接口要求
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
 * Network资源类型 - 确保满足RuntimeResource接口要求
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
 * 工厂函数: 创建Tool资源，确保关键属性存在
 */
export function createToolResource(name: string, spec: ToolConfig, namespace?: string): ToolResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Tool',
    metadata: {
      name,
      namespace: namespace || 'default',
    },
    spec,
  };
}

/**
 * 工厂函数: 创建Agent资源，确保关键属性存在
 */
export function createAgentResource(name: string, spec: AgentConfig, namespace?: string): AgentResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Agent',
    metadata: {
      name,
      namespace: namespace || 'default',
    },
    spec,
  };
}

/**
 * 工厂函数: 创建Workflow资源，确保关键属性存在
 */
export function createWorkflowResource(name: string, spec: WorkflowConfig, namespace?: string): WorkflowResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Workflow',
    metadata: {
      name,
      namespace: namespace || 'default',
    },
    spec,
  };
}

/**
 * 工厂函数: 创建Network资源，确保关键属性存在
 */
export function createNetworkResource(name: string, spec: NetworkConfig, namespace?: string): NetworkResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'Network',
    metadata: {
      name,
      namespace: namespace || 'default',
    },
    spec,
  };
}

/**
 * MastraPod配置Schema
 */
export const MastraPodSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('MastraPod'),
  metadata: MetadataSchema,
  
  // 全局配置
  providers: z.record(z.object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    config: z.record(z.any()).optional()
  })).optional(),
  
  memory: z.object({
    type: z.string(),
    url: z.string().optional(),
    config: z.record(z.any()).optional()
  }).optional(),
  
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    format: z.enum(['json', 'text']).optional(),
    config: z.record(z.any()).optional()
  }).optional(),
  
  // 资源定义
  resources: z.array(z.union([
    z.object({
      file: z.string(),
      when: z.any().optional()
    }),
    z.object({
      directory: z.string(),
      pattern: z.string().optional()
    }),
    z.any() // 内联资源定义
  ]))
});

export type MastraPod = z.infer<typeof MastraPodSchema>;

/**
 * 处理配置中的环境变量
 */
export function resolveEnvVariables(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\${([\w.-]+)}/g, (match, varName) => {
      const [namespace, key] = varName.split('.');
      if (namespace === 'env') {
        return process.env[key] || '';
      }
      return match; // 保持原样
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => resolveEnvVariables(item));
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = resolveEnvVariables(obj[key]);
    }
    return result;
  }
  
  return obj;
}

export function createMastraPodResource(name: string, spec: any, namespace?: string): MastraPod {
  return {
    apiVersion: 'mastra/v1',
    kind: 'MastraPod',
    metadata: {
      name,
      namespace: namespace || 'default'
    },
    ...spec
  };
}

/**
 * 自定义资源定义Schema
 */
export const CustomResourceDefinitionSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('CustomResourceDefinition'),
  metadata: MetadataSchema,
  spec: z.object({
    group: z.string(),
    names: z.object({
      kind: z.string(),
      plural: z.string(),
      singular: z.string().optional(),
      shortNames: z.array(z.string()).optional(),
    }),
    scope: z.enum(['Namespaced', 'Cluster']),
    validation: z.object({
      openAPIV3Schema: z.any()
    })
  }),
  status: z.object({
    phase: z.enum(['Pending', 'Active', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    acceptedNames: z.object({
      kind: z.string(),
      plural: z.string()
    }).optional()
  }).optional()
});

/**
 * 自定义资源定义接口
 */
export interface CustomResourceDefinition extends RuntimeResource {
  apiVersion: string;
  kind: 'CustomResourceDefinition';
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    group: string;
    names: {
      kind: string;
      plural: string;
      singular?: string;
      shortNames?: string[];
    };
    scope: 'Namespaced' | 'Cluster';
    validation: {
      openAPIV3Schema: any;
    };
  };
  status?: {
    phase: 'Pending' | 'Active' | 'Failed';
    conditions?: Condition[];
    acceptedNames?: {
      kind: string;
      plural: string;
    };
  };
}

/**
 * 创建自定义资源定义
 */
export function createCustomResourceDefinition(
  name: string,
  spec: Omit<CustomResourceDefinition['spec'], 'names'> & { 
    names: Omit<CustomResourceDefinition['spec']['names'], 'plural'> & { plural?: string } 
  }
): CustomResourceDefinition {
  // 如果未提供plural，从kind转换
  if (!spec.names.plural) {
    spec.names.plural = `${spec.names.kind.toLowerCase()}s`;
  }
  
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name
    },
    spec: spec as CustomResourceDefinition['spec']
  };
}

/**
 * LLM配置Schema
 */
export const LLMConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  options: z.record(z.any()).optional()
});

/**
 * LLM资源Schema
 */
export const LLMResourceSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('LLM'),
  metadata: MetadataSchema,
  spec: LLMConfigSchema,
  status: z.object({
    phase: z.enum(['Pending', 'Ready', 'Failed']),
    conditions: z.array(ConditionSchema).optional(),
    lastProbeTime: z.string().optional(),
    providerInfo: z.object({
      type: z.string().optional(),
      version: z.string().optional()
    }).optional()
  }).optional()
});

/**
 * LLM配置类型
 */
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * LLM资源类型
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
 */
export function createLLMResource(name: string, spec: LLMConfig, namespace?: string): LLMResource {
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'LLM',
    metadata: {
      name,
      namespace: namespace || 'default'
    },
    spec
  };
}
