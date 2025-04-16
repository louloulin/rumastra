# Mastra Runtime CRD (自定义资源定义)

CRD (Custom Resource Definition) 是 Mastra Runtime 的核心功能之一，允许用户定义自己的资源类型，并通过声明式 API 进行管理。CRD 模块借鉴了 Kubernetes 的设计理念，使用 OpenAPI v3 Schema 定义资源结构，并使用 Zod 进行运行时验证。

## 主要功能

- **自定义资源定义**: 通过 CRD 接口定义新的资源类型
- **OpenAPI Schema 验证**: 使用 OpenAPI v3 Schema 定义资源结构和验证规则
- **Zod 转换**: 将 OpenAPI Schema 转换为 Zod 验证模式
- **资源生命周期管理**: 管理 CRD 的注册、更新和删除过程

## 核心组件

### 1. CRD 控制器

`CRDController` 是 CRD 功能的核心实现，负责管理 CRD 的生命周期和验证自定义资源：

```typescript
export class CRDController extends AbstractController<CustomResourceDefinition> {
  // 存储注册的CRD和对应的Zod模式
  private customResourceSchemas = new Map<string, z.ZodSchema<any>>();
  
  // 构建和注册Schema
  private buildSchemaFromCRD(resource: CustomResourceDefinition): z.ZodSchema<any>;
  
  // 验证自定义资源
  validateCustomResource(resource: RuntimeResource): boolean;
  
  // 获取验证错误信息
  getValidationErrors(resource: RuntimeResource): string | null;
}
```

### 2. 自定义资源定义接口

CRD 接口定义了自定义资源的结构和验证规则：

```typescript
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
```

## OpenAPI Schema 支持

当前实现支持以下 OpenAPI v3 Schema 特性：

### 基础类型
- **string**: 字符串类型，支持格式验证、长度限制和正则表达式模式
- **number/integer**: 数值类型，支持范围限制和倍数验证
- **boolean**: 布尔类型
- **null**: 空值类型
- **object**: 对象类型，支持属性验证、必填属性、附加属性和依赖项
- **array**: 数组类型，支持项目验证、长度限制和唯一性验证

### 高级特性
- **格式验证**: 支持 date-time、date、time、email、uri、url、uuid、hostname、ipv4、ipv6 等格式
- **枚举**: 支持限定值的选择范围
- **数值范围**: 支持最小值、最大值、排除最小值和排除最大值
- **字符串长度**: 支持最小长度和最大长度
- **正则模式**: 支持字符串的正则表达式模式验证
- **属性依赖**: 支持属性间的依赖关系定义
- **模式依赖**: 支持条件模式验证
- **唯一项**: 支持数组中项目的唯一性验证
- **复合模式**: 支持 oneOf, anyOf, allOf 等复合模式验证

## 使用方法

### 1. 定义 CRD

```typescript
import { createCustomResourceDefinition } from '../types';

// 创建 CRD
const crd = createCustomResourceDefinition('datasources.mastra.ai', {
  group: 'mastra.ai',
  names: {
    kind: 'DataSource',
    plural: 'datasources'
  },
  scope: 'Namespaced',
  validation: {
    openAPIV3Schema: {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['postgres', 'mysql', 'mongodb'] },
            url: { type: 'string', format: 'uri' },
            credentials: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                password: { type: 'string' }
              },
              required: ['username', 'password']
            }
          },
          required: ['type', 'url']
        }
      }
    }
  }
});
```

### 2. 注册 CRD

```typescript
// 通过RuntimeManager注册
await runtimeManager.addResource(crd);
```

### 3. 创建和验证自定义资源

```typescript
// 创建自定义资源
const dataSource = {
  apiVersion: 'mastra.ai/v1',
  kind: 'DataSource',
  metadata: {
    name: 'my-postgres'
  },
  spec: {
    type: 'postgres',
    url: 'postgresql://localhost:5432/mydb',
    credentials: {
      username: 'postgres',
      password: 'secret'
    }
  }
};

// 验证自定义资源
if (runtimeManager.validateCustomResource(dataSource)) {
  console.log('DataSource is valid');
} else {
  console.error('Validation errors:', runtimeManager.getCustomResourceValidationErrors(dataSource));
}
```

## 扩展 CRD 功能

可以通过以下方式扩展 CRD 功能：

1. **自定义验证函数**: 添加自定义验证函数支持复杂的业务逻辑验证
2. **引用解析**: 增强对 `$ref` 引用的支持，实现复杂的模式复用
3. **版本管理**: 支持 CRD 的版本管理和跨版本兼容性
4. **转换规则**: 支持资源版本间的转换规则
5. **分类支持**: 添加对资源分类的支持，便于管理和展示 