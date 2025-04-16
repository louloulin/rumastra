import { EventBus } from '../eventbus';
import { AbstractController } from '../controller';
import { 
  CustomResourceDefinition, 
  RuntimeResource,
  ConditionSchema,
  MetadataSchema
} from '../../types';
import { z } from 'zod';

/**
 * 自定义资源控制器
 * 负责管理自定义资源定义的生命周期并实现OpenAPI Schema到Zod的转换
 * 
 * 主要功能：
 * 1. 注册和管理自定义资源定义(CRD)
 * 2. 将OpenAPI v3 Schema转换为Zod验证模式
 * 3. 验证符合CRD的自定义资源
 * 4. 维护CRD的生命周期状态
 */
export class CRDController extends AbstractController<CustomResourceDefinition> {
  // 存储注册的CRD和对应的Zod模式
  private customResourceSchemas = new Map<string, z.ZodSchema<any>>();
  // 存储原始的OpenAPI Schema以供引用解析
  private openAPISchemas = new Map<string, any>();
  
  constructor(eventBus: EventBus) {
    super(eventBus);
  }
  
  /**
   * 获取资源期望状态
   */
  async getDesiredState(resource: CustomResourceDefinition): Promise<any> {
    // 验证CRD规范
    const validationResult = this.validateCRD(resource);
    if (!validationResult.valid) {
      // 返回失败状态，而不是抛出错误
      return {
        phase: 'Failed',
        conditions: [
          {
            type: 'Registered',
            status: 'False',
            reason: 'ValidationFailed',
            message: `Invalid CRD definition: ${validationResult.message}`,
            lastTransitionTime: new Date().toISOString()
          }
        ]
      };
    }
    
    try {
      // 构建并注册Zod Schema
      const schema = this.buildSchemaFromCRD(resource);
      const crdKey = this.getCRDKey(resource.spec.group, resource.spec.names.kind);
      this.customResourceSchemas.set(crdKey, schema);
      
      // 存储原始的OpenAPI Schema
      this.openAPISchemas.set(crdKey, resource.spec.validation.openAPIV3Schema);
      
      // 发布CRD注册事件
      this.eventBus.publish('crd.registered', {
        resourceId: this.getResourceId(resource),
        group: resource.spec.group,
        kind: resource.spec.names.kind,
        plural: resource.spec.names.plural,
        scope: resource.spec.scope
      });
      
      // 返回期望状态
      return {
        phase: 'Active',
        conditions: [
          {
            type: 'Registered',
            status: 'True',
            reason: 'SchemaRegistered',
            message: `CRD ${resource.metadata.name} successfully registered`,
            lastTransitionTime: new Date().toISOString()
          }
        ],
        acceptedNames: {
          kind: resource.spec.names.kind,
          plural: resource.spec.names.plural
        }
      };
    } catch (error) {
      // 返回失败状态
      return {
        phase: 'Failed',
        conditions: [
          {
            type: 'Registered',
            status: 'False',
            reason: 'SchemaError',
            message: `Failed to build schema: ${(error as Error).message}`,
            lastTransitionTime: new Date().toISOString()
          }
        ]
      };
    }
  }
  
  /**
   * 获取资源当前状态
   */
  async getCurrentState(resource: CustomResourceDefinition): Promise<any> {
    const crdKey = this.getCRDKey(resource.spec.group, resource.spec.names.kind);
    const isRegistered = this.customResourceSchemas.has(crdKey);
    
    return {
      phase: isRegistered ? 'Active' : 'Pending',
      conditions: resource.status?.conditions || []
    };
  }
  
  /**
   * 更新资源状态
   */
  protected async updateResourceState(
    resource: CustomResourceDefinition, 
    desiredState: any, 
    currentState: any
  ): Promise<void> {
    if (!resource.status) {
      resource.status = { phase: 'Pending', conditions: [] };
    }
    
    // 更新状态
    resource.status.phase = desiredState.phase;
    resource.status.conditions = desiredState.conditions;
    resource.status.acceptedNames = desiredState.acceptedNames;
  }
  
  /**
   * 处理协调失败
   */
  protected async handleReconcileFailure(
    resource: CustomResourceDefinition, 
    error: any
  ): Promise<void> {
    if (!resource.status) {
      resource.status = { phase: 'Failed', conditions: [] };
    } else {
      resource.status.phase = 'Failed';
    }
    
    // 确保conditions数组存在
    if (!resource.status.conditions) {
      resource.status.conditions = [];
    }
    
    // 添加失败条件
    resource.status.conditions.push({
      type: 'Registered',
      status: 'False',
      reason: 'RegistrationFailed',
      message: error.message || 'Unknown error occurred during CRD registration',
      lastTransitionTime: new Date().toISOString()
    });
    
    // 发布失败事件
    this.eventBus.publish('crd.registration.failed', {
      resourceId: this.getResourceId(resource),
      error: error.message || 'Unknown error'
    });
  }
  
  /**
   * 清理资源
   */
  public async cleanupResource(resource: CustomResourceDefinition): Promise<void> {
    // 从注册表中移除CRD
    const crdKey = this.getCRDKey(resource.spec.group, resource.spec.names.kind);
    this.customResourceSchemas.delete(crdKey);
    this.openAPISchemas.delete(crdKey);
    
    // 发布CRD移除事件
    this.eventBus.publish('crd.removed', {
      resourceId: this.getResourceId(resource),
      group: resource.spec.group,
      kind: resource.spec.names.kind
    });
  }
  
  /**
   * 验证CRD定义
   * @returns 验证结果对象，包含valid和message属性
   */
  private validateCRD(resource: CustomResourceDefinition): { valid: boolean; message?: string } {
    // 验证必要字段存在
    if (!resource.spec.group) {
      return { valid: false, message: "Group name cannot be empty" };
    }
    
    if (!resource.spec.names.kind) {
      return { valid: false, message: "Kind name cannot be empty" };
    }
    
    if (!resource.spec.names.plural) {
      return { valid: false, message: "Plural name cannot be empty" };
    }
    
    // 确保名称符合DNS子域名格式
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
    if (!nameRegex.test(resource.spec.group)) {
      return { valid: false, message: "Group name must conform to DNS subdomain format" };
    }
    
    if (!nameRegex.test(resource.spec.names.plural)) {
      return { valid: false, message: "Plural name must conform to DNS subdomain format" };
    }
    
    // 验证OpenAPI Schema的结构
    const schema = resource.spec.validation?.openAPIV3Schema;
    if (!schema || typeof schema !== 'object') {
      return { valid: false, message: "OpenAPI v3 Schema is required and must be an object" };
    }
    
    // 验证简略，完整验证在buildSchemaFromCRD中进行
    return { valid: true };
  }
  
  /**
   * 从CRD构建Zod Schema
   */
  private buildSchemaFromCRD(resource: CustomResourceDefinition): z.ZodSchema<any> {
    const { openAPIV3Schema } = resource.spec.validation;
    
    // 预处理，确保必要属性存在
    const processedSchema = this.preprocessOpenAPISchema(openAPIV3Schema);
    
    // 创建基础Schema
    return z.object({
      apiVersion: z.string(),
      kind: z.literal(resource.spec.names.kind),
      metadata: MetadataSchema,
      spec: this.convertOpenAPISchemaToZod(processedSchema.properties?.spec || {}),
      status: z.any().optional()
    });
  }
  
  /**
   * 预处理OpenAPI Schema，确保必要结构存在
   */
  private preprocessOpenAPISchema(schema: any): any {
    // 如果是引用，直接返回
    if (schema.$ref) {
      return schema;
    }
    
    // 确保类型存在
    if (!schema.type && !schema.oneOf && !schema.anyOf && !schema.allOf) {
      // 默认为对象类型
      schema.type = 'object';
    }
    
    // 处理嵌套属性
    if (schema.properties) {
      const processedProperties: Record<string, any> = {};
      
      for (const [key, prop] of Object.entries<any>(schema.properties)) {
        processedProperties[key] = this.preprocessOpenAPISchema(prop);
      }
      
      schema.properties = processedProperties;
    }
    
    // 处理数组项
    if (schema.items) {
      schema.items = this.preprocessOpenAPISchema(schema.items);
    }
    
    return schema;
  }
  
  /**
   * 将OpenAPI Schema转换为Zod Schema
   * 增强版本处理更复杂的OpenAPI特性
   */
  private convertOpenAPISchemaToZod(schema: any, schemaPath: string = ''): z.ZodTypeAny {
    // 处理空Schema
    if (!schema) {
      return z.any();
    }
    
    // 处理引用 ($ref)
    if (schema.$ref) {
      // 简化处理，不支持完整的JSON引用解析
      // 实际实现应该支持解析完整的 JSON Pointer
      return z.any().describe(`Reference: ${schema.$ref}`);
    }
    
    // 处理复合类型
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      return z.union(schema.oneOf.map((s: any, i: number) => 
        this.convertOpenAPISchemaToZod(s, `${schemaPath}/oneOf/${i}`)
      ));
    }
    
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      return z.union(schema.anyOf.map((s: any, i: number) => 
        this.convertOpenAPISchemaToZod(s, `${schemaPath}/anyOf/${i}`)
      ));
    }
    
    if (schema.allOf && Array.isArray(schema.allOf)) {
      // allOf 在 Zod 中可以近似为 .and()，但这里采用简化处理
      // 更完整的实现应该合并所有模式属性
      if (schema.allOf.length === 0) {
        return z.any();
      }
      
      let baseSchema = this.convertOpenAPISchemaToZod(schema.allOf[0], `${schemaPath}/allOf/0`);
      
      for (let i = 1; i < schema.allOf.length; i++) {
        const nextSchema = this.convertOpenAPISchemaToZod(schema.allOf[i], `${schemaPath}/allOf/${i}`);
        baseSchema = baseSchema.and(nextSchema);
      }
      
      return baseSchema;
    }
    
    // 处理基本类型
    if (!schema.type) {
      return z.any();
    }
    
    switch (schema.type) {
      case 'object': {
        const propertySchemas: Record<string, z.ZodTypeAny> = {};
        
        // 处理属性
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries<any>(schema.properties)) {
            propertySchemas[key] = this.convertOpenAPISchemaToZod(
              propSchema, 
              `${schemaPath}/properties/${key}`
            );
            
            // 处理required属性
            if (schema.required && schema.required.includes(key)) {
              // 不变，保持必填
            } else {
              propertySchemas[key] = propertySchemas[key].optional();
            }
          }
        }
        
        let objectSchema = z.object(propertySchemas);
        
        // 处理additionalProperties
        if (schema.additionalProperties === true) {
          return objectSchema.passthrough();
        } else if (typeof schema.additionalProperties === 'object') {
          // 特定类型的额外属性
          const additionalSchema = this.convertOpenAPISchemaToZod(
            schema.additionalProperties, 
            `${schemaPath}/additionalProperties`
          );
          return z.record(z.string(), additionalSchema).and(objectSchema) as z.ZodTypeAny;
        }
        
        // 处理属性依赖项 (dependencies)
        if (schema.dependencies && typeof schema.dependencies === 'object') {
          const tempSchema = objectSchema;  // 保存引用，避免类型错误
          
          for (const [prop, dependency] of Object.entries<any>(schema.dependencies)) {
            if (Array.isArray(dependency)) {
              // 属性依赖 - 如果prop存在，则依赖项也必须存在
              const rule = (obj: any) => !obj[prop] || dependency.every((dep: string) => dep in obj);
              const message = `When property '${prop}' exists, properties [${dependency.join(', ')}] must also exist`;
              objectSchema = tempSchema.superRefine((data, ctx) => {
                if (!rule(data)) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: message,
                    path: [],
                  });
                }
              }) as any;
            } else if (typeof dependency === 'object') {
              // 模式依赖 - 如果prop存在，则必须符合依赖的模式
              const depSchema = this.convertOpenAPISchemaToZod(
                dependency, 
                `${schemaPath}/dependencies/${prop}`
              );
              const rule = (obj: any) => !obj[prop] || depSchema.safeParse(obj).success;
              const message = `When property '${prop}' exists, object must satisfy the dependency schema`;
              objectSchema = tempSchema.superRefine((data, ctx) => {
                if (!rule(data)) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: message,
                    path: [],
                  });
                }
              }) as any;
            }
          }
        }
        
        // 处理属性数量限制
        if (schema.minProperties !== undefined) {
          const min = schema.minProperties;
          const tempSchema = objectSchema; // 保存引用，避免类型错误
          
          objectSchema = tempSchema.superRefine((data, ctx) => {
            if (Object.keys(data).length < min) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Object must have at least ${min} properties`,
                path: [],
              });
            }
          }) as any;
        }
        
        if (schema.maxProperties !== undefined) {
          const max = schema.maxProperties;
          const tempSchema = objectSchema; // 保存引用，避免类型错误
          
          objectSchema = tempSchema.superRefine((data, ctx) => {
            if (Object.keys(data).length > max) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Object must have at most ${max} properties`,
                path: [],
              });
            }
          }) as any;
        }
        
        return objectSchema;
      }
        
      case 'array': {
        const itemsSchema = schema.items ? 
          this.convertOpenAPISchemaToZod(schema.items, `${schemaPath}/items`) : 
          z.any();
          
        let arraySchema = z.array(itemsSchema);
        
        // 处理数组长度限制
        if (schema.minItems !== undefined) {
          arraySchema = arraySchema.min(schema.minItems);
        }
        
        if (schema.maxItems !== undefined) {
          arraySchema = arraySchema.max(schema.maxItems);
        }
        
        // 处理唯一项目
        if (schema.uniqueItems) {
          const tempSchema = arraySchema; // 保存引用，避免类型错误
          
          arraySchema = tempSchema.superRefine((data, ctx) => {
            const uniqueItems = new Set<string>();
            for (let i = 0; i < data.length; i++) {
              const serialized = JSON.stringify(data[i]);
              if (uniqueItems.has(serialized)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Array items must be unique",
                  path: [i],
                });
              }
              uniqueItems.add(serialized);
            }
          }) as any;
        }
        
        return arraySchema;
      }
        
      case 'string': {
        let stringSchema = z.string();
        
        // 处理字符串格式
        if (schema.format) {
          switch (schema.format) {
            case 'date-time':
              stringSchema = z.string().datetime();
              break;
            case 'date':
              stringSchema = z.string().regex(
                /^\d{4}-\d{2}-\d{2}$/,
                { message: 'String must be a valid date in YYYY-MM-DD format' }
              );
              break;
            case 'time':
              stringSchema = z.string().regex(
                /^\d{2}:\d{2}:\d{2}(.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
                { message: 'String must be a valid time in HH:MM:SS format' }
              );
              break;
            case 'email':
              stringSchema = z.string().email();
              break;
            case 'uri':
            case 'url':
              stringSchema = z.string().url();
              break;
            case 'uuid':
              stringSchema = z.string().uuid();
              break;
            case 'hostname':
              stringSchema = z.string().regex(
                /^[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
                { message: 'String must be a valid hostname' }
              );
              break;
            case 'ipv4':
              stringSchema = z.string().ip({ version: 'v4' });
              break;
            case 'ipv6':
              stringSchema = z.string().ip({ version: 'v6' });
              break;
            // 更多格式可以根据需要添加
          }
        }
        
        // 处理枚举
        if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
          // 确保枚举至少有一个值
          return z.enum(schema.enum as [string, ...string[]]);
        }
        
        // 处理长度限制
        if (schema.minLength !== undefined) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        
        if (schema.maxLength !== undefined) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        
        // 处理正则表达式
        if (schema.pattern) {
          try {
            const regex = new RegExp(schema.pattern);
            stringSchema = stringSchema.regex(regex);
          } catch (error) {
            console.warn(`Invalid regex pattern in schema: ${schema.pattern}`, error);
          }
        }
        
        // 处理内容编码和媒体类型（简化处理）
        if (schema.contentEncoding || schema.contentMediaType) {
          stringSchema = stringSchema.describe(`Content: ${schema.contentMediaType || ''}, Encoding: ${schema.contentEncoding || ''}`);
        }
        
        return stringSchema;
      }
        
      case 'number':
      case 'integer': {
        // 对整数使用特殊处理
        let numberSchema = schema.type === 'integer' ? z.number().int() : z.number();
        
        // 处理范围约束
        if (schema.minimum !== undefined) {
          numberSchema = schema.exclusiveMinimum 
            ? numberSchema.gt(schema.minimum)
            : numberSchema.gte(schema.minimum);
        }
        
        if (schema.maximum !== undefined) {
          numberSchema = schema.exclusiveMaximum 
            ? numberSchema.lt(schema.maximum)
            : numberSchema.lte(schema.maximum);
        }
        
        // 处理倍数约束
        if (schema.multipleOf !== undefined) {
          const multipleOf = schema.multipleOf;
          return numberSchema.refine(
            n => n % multipleOf === 0,
            { message: `Number must be a multiple of ${multipleOf}` }
          );
        }
        
        // 处理数值常量
        if (schema.const !== undefined) {
          return z.literal(schema.const);
        }
        
        return numberSchema;
      }
        
      case 'boolean':
        return z.boolean();
        
      case 'null':
        return z.null();
        
      default:
        return z.any();
    }
  }
  
  /**
   * 生成CRD键
   */
  private getCRDKey(group: string, kind: string): string {
    return `${group}/${kind}`;
  }
  
  /**
   * 获取已注册的Schema
   */
  getSchema(group: string, kind: string): z.ZodSchema<any> | undefined {
    const key = this.getCRDKey(group, kind);
    return this.customResourceSchemas.get(key);
  }
  
  /**
   * 获取所有已注册的Schema键
   */
  getAllRegisteredCRDs(): string[] {
    return Array.from(this.customResourceSchemas.keys());
  }
  
  /**
   * 验证自定义资源
   * @param resource 要验证的运行时资源
   * @returns 验证结果
   */
  validateCustomResource(resource: RuntimeResource): boolean {
    try {
      if (!resource.apiVersion || !resource.kind) {
        return false;
      }
      
      // 提取组和版本
      const [group, version] = resource.apiVersion.split('/');
      const key = this.getCRDKey(group, resource.kind);
      
      // 查找对应的Schema
      const schema = this.customResourceSchemas.get(key);
      if (!schema) {
        return false;
      }
      
      // 验证资源
      schema.parse(resource);
      return true;
    } catch (error) {
      console.error(`Custom resource validation failed:`, error);
      return false;
    }
  }
  
  /**
   * 获取验证错误信息
   * @param resource 要验证的运行时资源
   * @returns 验证错误信息，如果验证通过则返回null
   */
  getValidationErrors(resource: RuntimeResource): string | null {
    try {
      if (!resource.apiVersion || !resource.kind) {
        return 'Missing apiVersion or kind';
      }
      
      // 提取组和版本
      const [group, version] = resource.apiVersion.split('/');
      const key = this.getCRDKey(group, resource.kind);
      
      // 查找对应的Schema
      const schema = this.customResourceSchemas.get(key);
      if (!schema) {
        return `No schema found for ${resource.kind} in group ${group}`;
      }
      
      // 验证资源
      schema.parse(resource);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return JSON.stringify(error.format(), null, 2);
      }
      return (error as Error).message;
    }
  }
} 