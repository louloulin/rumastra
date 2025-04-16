import { Metadata, Condition } from './common';

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
  // 确保有效的规范
  if (!spec.names.kind) {
    throw new Error('Must specify kind in CustomResourceDefinition names');
  }
  
  // 处理复数形式
  if (!spec.names.plural) {
    spec.names.plural = `${spec.names.kind.toLowerCase()}s`;
  }
  
  // 创建完整的规范
  const fullSpec = {
    ...spec,
    names: {
      ...spec.names,
      plural: spec.names.plural
    }
  };
  
  // 返回自定义资源定义
  return {
    apiVersion: 'mastra.ai/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name: name
    },
    spec: fullSpec,
    status: {
      phase: 'Pending',
      conditions: []
    }
  };
} 