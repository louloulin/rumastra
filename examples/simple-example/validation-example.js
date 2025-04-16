/**
 * 资源验证专用示例
 * 
 * 这个例子演示如何使用简化的 API 来验证各种资源
 */

import { SimpleResourceManager, loadResources } from 'kastra';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import yaml from 'js-yaml';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 彩色输出帮助函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

// 创建多个无效资源对象
const invalidResources = [
  // 无效的 DataSource 示例 - 缺少 URL
  {
    apiVersion: 'mastra.ai/v1',
    kind: 'DataSource',
    metadata: {
      name: 'invalid-postgres-1',
      namespace: 'default'
    },
    spec: {
      type: 'postgres',
      // 缺少必填字段 url
      credentials: {
        username: 'admin',
        // 密码太短
        password: 'abc'
      }
    }
  },
  
  // 无效的 DataSource 示例 - 不支持的类型
  {
    apiVersion: 'mastra.ai/v1',
    kind: 'DataSource',
    metadata: {
      name: 'invalid-postgres-2',
      namespace: 'default'
    },
    spec: {
      // 不在枚举值中的类型
      type: 'oracle',
      url: 'oracle://localhost:1521/orcl',
      credentials: {
        username: 'admin',
        password: 'password123'
      }
    }
  },
  
  // 无效的 Tool 示例 - 缺少 execute 字段
  {
    apiVersion: 'mastra.ai/v1',
    kind: 'Tool',
    metadata: {
      name: 'invalid-tool',
      namespace: 'default'
    },
    spec: {
      id: 'invalid-tool',
      type: 'api',
      description: "无效的工具示例"
      // 缺少 execute 字段
    }
  },
  
  // 无效的 DataSource 示例 - URL 格式错误
  {
    apiVersion: 'mastra.ai/v1',
    kind: 'DataSource',
    metadata: {
      name: 'invalid-url',
      namespace: 'default'
    },
    spec: {
      type: 'postgres',
      url: 'not-a-valid-url',  // 这不是有效的 URI
      credentials: {
        username: 'admin',
        password: 'secure_password'
      }
    }
  },
  
  // 无效的 DataSource 示例 - 多种错误组合
  {
    apiVersion: 'mastra.ai/v1',
    kind: 'DataSource',
    metadata: {
      name: 'multiple-errors',
      namespace: 'default'
    },
    spec: {
      type: 'postgres',
      url: 'postgres://localhost/db',
      credentials: {
        // 缺少 username
        password: 'pwd'
      },
      // 额外的未知属性
      unknown_field: "不应该出现的字段"
    }
  }
];

/**
 * 演示如何验证 CustomResourceDefinition
 */
async function demonstrateCRDValidation() {
  console.log(`${colors.bright}${colors.blue}1. CustomResourceDefinition 验证${colors.reset}\n`);
  
  try {
    // 创建一个简化的资源管理器
    const manager = new SimpleResourceManager();
    
    // 加载含有 CRD 的资源文件
    const podConfigPath = path.join(__dirname, 'resources.yaml');
    const toolCrdPath = path.join(__dirname, 'tool-crd.yaml');
    
    console.log(`${colors.cyan}加载包含 CRD 的资源文件:${colors.reset}`);
    console.log(`  - ${podConfigPath}`);
    console.log(`  - ${toolCrdPath}`);
    
    // 加载资源
    const mainResources = await manager.loadFile(podConfigPath);
    const toolCrdResources = await manager.loadFile(toolCrdPath);
    
    // 合并所有资源
    const allResources = [...mainResources, ...toolCrdResources];
    
    // 找到 CRD 资源
    const crdResources = allResources.filter(r => r.kind === 'CustomResourceDefinition');
    console.log(`${colors.green}✓ 找到 ${crdResources.length} 个 CRD 资源定义${colors.reset}`);
    
    // 注册 CRD 资源
    console.log(`\n${colors.cyan}注册 CRD 资源...${colors.reset}`);
    const registrationResult = await manager.registerResources(crdResources);
    console.log(`${colors.green}✓ 成功注册 ${registrationResult.success} 个 CRD${colors.reset}`);
    
    // 获取已注册的 CRD
    const registeredCRDs = manager.getResourcesByKind('CustomResourceDefinition');
    
    if (registeredCRDs.length > 0) {
      console.log(`\n${colors.cyan}注册的 CRD 详情:${colors.reset}`);
      
      for (const crd of registeredCRDs) {
        const group = crd.spec.group;
        const kind = crd.spec.names.kind;
        const plural = crd.spec.names.plural;
        
        console.log(`\n  ${colors.bright}${kind} (${plural}.${group})${colors.reset}`);
        console.log(`  ${colors.yellow}验证规则:${colors.reset}`);
        
        // 打印验证规则（简化显示）
        if (crd.spec.validation && crd.spec.validation.openAPIV3Schema) {
          const schema = crd.spec.validation.openAPIV3Schema;
          printSchema(schema, 2);
        } else {
          console.log(`  ${colors.red}未定义验证规则${colors.reset}`);
        }
      }
    }
    
    return manager; // 返回管理器用于后续测试
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * 打印 Schema 结构（递归）
 */
function printSchema(schema, indent = 0, prefix = '') {
  const indentStr = '  '.repeat(indent);
  
  // 打印类型信息
  if (schema.type) {
    console.log(`${indentStr}${prefix}${colors.dim}类型:${colors.reset} ${schema.type}`);
  }
  
  // 打印格式信息
  if (schema.format) {
    console.log(`${indentStr}${prefix}${colors.dim}格式:${colors.reset} ${schema.format}`);
  }
  
  // 打印枚举值
  if (schema.enum) {
    console.log(`${indentStr}${prefix}${colors.dim}枚举值:${colors.reset} ${schema.enum.join(', ')}`);
  }
  
  // 打印最小/最大长度
  if (schema.minLength) {
    console.log(`${indentStr}${prefix}${colors.dim}最小长度:${colors.reset} ${schema.minLength}`);
  }
  
  // 打印必填属性
  if (schema.required && schema.required.length > 0) {
    console.log(`${indentStr}${prefix}${colors.dim}必填字段:${colors.reset} ${schema.required.join(', ')}`);
  }
  
  // 递归打印属性
  if (schema.properties) {
    console.log(`${indentStr}${prefix}${colors.dim}属性:${colors.reset}`);
    
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      console.log(`${indentStr}  ${colors.magenta}${propName}:${colors.reset}`);
      printSchema(propSchema, indent + 2);
    }
  }
}

/**
 * 演示如何验证自定义资源
 */
async function demonstrateCustomResourceValidation(manager) {
  console.log(`\n${colors.bright}${colors.blue}2. 自定义资源验证${colors.reset}\n`);
  
  if (!manager) {
    console.error(`${colors.red}缺少 ResourceManager 实例，无法进行验证${colors.reset}`);
    return;
  }
  
  try {
    // 直接使用预定义的无效资源数组
    console.log(`${colors.cyan}验证预定义的无效资源...${colors.reset}`);
    console.log(`${colors.green}✓ 加载了 ${invalidResources.length} 个资源进行验证${colors.reset}`);
    
    // 逐个验证资源
    console.log(`\n${colors.cyan}验证资源...${colors.reset}`);
    
    const validationResults = [];
    
    for (const resource of invalidResources) {
      const isValid = manager.validateCustomResource(resource);
      const errors = isValid ? [] : manager.getValidationErrors(resource);
      
      validationResults.push({
        name: resource.metadata.name,
        kind: resource.kind,
        isValid,
        errors
      });
    }
    
    // 显示验证结果
    console.log(`\n${colors.cyan}验证结果摘要:${colors.reset}`);
    console.log(`  ${colors.green}✓ 有效:${colors.reset} ${validationResults.filter(r => r.isValid).length} 个资源`);
    console.log(`  ${colors.red}✗ 无效:${colors.reset} ${validationResults.filter(r => !r.isValid).length} 个资源`);
    
    // 详细的验证结果
    console.log(`\n${colors.cyan}详细验证结果:${colors.reset}`);
    
    for (const result of validationResults) {
      if (result.isValid) {
        console.log(`\n  ${colors.green}✓ ${result.kind}/${result.name}${colors.reset}: 验证通过`);
      } else {
        console.log(`\n  ${colors.red}✗ ${result.kind}/${result.name}${colors.reset}: 验证失败`);
        
        if (result.errors && result.errors.length > 0) {
          // 格式化错误信息，使其更易读
          const formattedErrors = formatValidationErrors(result.errors);
          formattedErrors.forEach(err => {
            console.log(`    - ${err}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

/**
 * 格式化验证错误信息，使其更易读
 */
function formatValidationErrors(errors) {
  if (typeof errors === 'string') {
    // 尝试拆分错误消息
    return errors.split(';').map(e => e.trim()).filter(e => e);
  }
  
  if (Array.isArray(errors)) {
    return errors;
  }
  
  // 处理 ZodError 或其他复杂错误对象
  if (errors && typeof errors === 'object') {
    if (errors.issues) {
      // ZodError 格式的错误
      return errors.issues.map(issue => {
        const path = issue.path ? issue.path.join('.') : '';
        return `字段 ${path}: ${issue.message}`;
      });
    }
    
    if (errors._errors) {
      // 尝试处理嵌套错误结构
      return flattenNestedErrors(errors);
    }
    
    // 尝试直接转换为字符串
    return [`${JSON.stringify(errors, null, 2)}`];
  }
  
  return [`${errors}`];
}

/**
 * 扁平化嵌套的错误结构
 */
function flattenNestedErrors(errors, prefix = '') {
  let result = [];
  
  if (errors._errors && errors._errors.length > 0) {
    errors._errors.forEach(err => {
      result.push(`${prefix ? prefix + ': ' : ''}${err}`);
    });
  }
  
  // 递归处理嵌套字段的错误
  for (const [key, value] of Object.entries(errors)) {
    if (key !== '_errors' && typeof value === 'object') {
      const nestedPrefix = prefix ? `${prefix}.${key}` : key;
      result = result.concat(flattenNestedErrors(value, nestedPrefix));
    }
  }
  
  return result;
}

/**
 * 演示使用编程方式创建和验证资源
 */
async function demonstrateProgrammaticValidation(manager) {
  console.log(`\n${colors.bright}${colors.blue}3. 以编程方式创建和验证资源${colors.reset}\n`);
  
  if (!manager) {
    console.error(`${colors.red}缺少 ResourceManager 实例，无法进行验证${colors.reset}`);
    return;
  }
  
  try {
    console.log(`${colors.cyan}创建和验证一系列资源...${colors.reset}\n`);
    
    // 有效的 DataSource
    const validDataSource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'programmatic-valid-ds',
        namespace: 'default'
      },
      spec: {
        type: 'postgres',
        url: 'postgresql://localhost:5432/mydb',
        credentials: {
          username: 'admin',
          password: 'secure_password'
        }
      }
    };
    
    // 无效的 DataSource - 缺少 url
    const invalidDataSource1 = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'programmatic-invalid-ds-1',
        namespace: 'default'
      },
      spec: {
        type: 'postgres',
        // 缺少 url
        credentials: {
          username: 'admin',
          password: 'secure_password'
        }
      }
    };
    
    // 无效的 DataSource - 错误的类型
    const invalidDataSource2 = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'programmatic-invalid-ds-2',
        namespace: 'default'
      },
      spec: {
        type: 'sqlite', // 不在枚举值中
        url: 'sqlite:///path/to/db.sqlite',
        credentials: {
          username: 'admin',
          password: 'secure_password'
        }
      }
    };
    
    // 创建资源数组
    const resourcesToValidate = [
      validDataSource,
      invalidDataSource1,
      invalidDataSource2
    ];
    
    // 验证资源并显示结果
    for (const resource of resourcesToValidate) {
      const isValid = manager.validateCustomResource(resource);
      const errors = isValid ? [] : manager.getValidationErrors(resource);
      
      if (isValid) {
        console.log(`${colors.green}✓ ${resource.metadata.name}${colors.reset}: 验证通过`);
      } else {
        console.log(`${colors.red}✗ ${resource.metadata.name}${colors.reset}: 验证失败`);
        
        if (errors && errors.length > 0) {
          const formattedErrors = formatValidationErrors(errors);
          formattedErrors.forEach(err => {
            console.log(`  - ${err}`);
          });
        }
      }
      
      console.log(''); // 添加空行分隔
    }
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

/**
 * 演示有条件的验证
 */
async function demonstrateConditionalValidation(manager) {
  console.log(`${colors.bright}${colors.blue}4. 有条件的验证和用例${colors.reset}\n`);
  
  if (!manager) {
    console.error(`${colors.red}缺少 ResourceManager 实例，无法进行验证${colors.reset}`);
    return;
  }
  
  try {
    console.log(`${colors.cyan}演示根据环境应用不同验证规则...${colors.reset}\n`);
    
    // 模拟不同环境的资源
    const prodResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'prod-database',
        namespace: 'production',
        labels: {
          environment: 'production'
        }
      },
      spec: {
        type: 'postgres',
        url: 'postgresql://prod-host:5432/prod-db',
        credentials: {
          username: 'prod-user',
          password: 'prod-password-123456'
        }
      }
    };
    
    const devResource = {
      apiVersion: 'mastra.ai/v1',
      kind: 'DataSource',
      metadata: {
        name: 'dev-database',
        namespace: 'development',
        labels: {
          environment: 'development'
        }
      },
      spec: {
        type: 'postgres',
        url: 'postgresql://localhost:5432/dev-db',
        credentials: {
          username: 'dev-user',
          password: 'dev123'  // 设置一个短但符合基本要求的密码
        }
      }
    };
    
    // 为不同环境定义不同的验证规则
    const validateResourceByEnvironment = (resource) => {
      const environment = resource.metadata.labels?.environment || 'development';
      const isProd = environment === 'production';
      
      // 基本验证
      const isBasicValid = manager.validateCustomResource(resource);
      
      if (!isBasicValid) {
        return {
          isValid: false,
          errors: formatValidationErrors(manager.getValidationErrors(resource))
        };
      }
      
      // 生产环境特定验证
      if (isProd) {
        const errors = [];
        
        // 验证生产环境的密码强度
        const password = resource.spec.credentials?.password || '';
        if (password.length < 10) {
          errors.push('生产环境密码长度必须至少为10个字符');
        }
        
        if (!/[A-Z]/.test(password)) {
          errors.push('生产环境密码必须包含至少一个大写字母');
        }
        
        if (!/[0-9]/.test(password)) {
          errors.push('生产环境密码必须包含至少一个数字');
        }
        
        // 验证 URL 不是 localhost
        if (resource.spec.url.includes('localhost')) {
          errors.push('生产环境不允许使用 localhost 作为数据库主机');
        }
        
        return {
          isValid: errors.length === 0,
          errors
        };
      }
      
      // 开发环境默认通过
      return { isValid: true, errors: [] };
    };
    
    // 验证并显示结果
    const resourcesForCondValidation = [prodResource, devResource];
    
    for (const resource of resourcesForCondValidation) {
      const environment = resource.metadata.labels?.environment || 'unknown';
      console.log(`验证 ${colors.cyan}${environment}${colors.reset} 环境的资源 ${colors.bright}${resource.metadata.name}${colors.reset}:`);
      
      const { isValid, errors } = validateResourceByEnvironment(resource);
      
      if (isValid) {
        console.log(`${colors.green}✓ 验证通过${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ 验证失败${colors.reset}`);
        errors.forEach(err => {
          console.log(`  - ${err}`);
        });
      }
      
      console.log(''); // 添加空行分隔
    }
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

/**
 * 演示批量验证和验证报告
 */
async function demonstrateBatchValidation(manager) {
  console.log(`${colors.bright}${colors.blue}5. 批量验证和验证报告${colors.reset}\n`);
  
  if (!manager) {
    console.error(`${colors.red}缺少 ResourceManager 实例，无法进行验证${colors.reset}`);
    return;
  }
  
  try {
    console.log(`${colors.cyan}创建包含多种资源类型的批量验证场景...${colors.reset}\n`);
    
    // 混合有效和无效的各种资源
    const mixedResources = [
      // 有效的数据源
      {
        apiVersion: 'mastra.ai/v1',
        kind: 'DataSource',
        metadata: {
          name: 'valid-postgres',
          namespace: 'default'
        },
        spec: {
          type: 'postgres',
          url: 'postgresql://localhost:5432/mydb',
          credentials: {
            username: 'admin',
            password: 'secure_password'
          }
        }
      },
      // 有效的工具
      {
        apiVersion: 'mastra.ai/v1',
        kind: 'Tool',
        metadata: {
          name: 'valid-tool',
          namespace: 'default'
        },
        spec: {
          id: 'valid-tool',
          type: 'api',
          description: "有效的工具示例",
          execute: "./tools/example.js"
        }
      },
      // 无效的数据源 (密码太短)
      {
        apiVersion: 'mastra.ai/v1',
        kind: 'DataSource',
        metadata: {
          name: 'weak-password',
          namespace: 'default'
        },
        spec: {
          type: 'postgres',
          url: 'postgresql://localhost:5432/mydb',
          credentials: {
            username: 'admin',
            password: 'pwd' // 密码太短
          }
        }
      },
      // 未知资源类型 (没有相应的 CRD)
      {
        apiVersion: 'mastra.ai/v1',
        kind: 'UnknownResource',
        metadata: {
          name: 'unknown-type',
          namespace: 'default'
        },
        spec: {
          someProp: 'someValue'
        }
      }
    ];
    
    // 执行批量验证
    console.log(`${colors.yellow}执行批量验证...${colors.reset}\n`);
    
    // 创建验证报告
    const validationReport = {
      totalResources: mixedResources.length,
      validResources: 0,
      invalidResources: 0,
      unknownResourceKinds: 0,
      resultsByKind: {},
      errors: [],
      validationTime: 0
    };
    
    const startTime = Date.now();
    
    for (const resource of mixedResources) {
      const kind = resource.kind;
      const name = resource.metadata.name;
      
      // 初始化资源类型统计
      if (!validationReport.resultsByKind[kind]) {
        validationReport.resultsByKind[kind] = {
          total: 0,
          valid: 0,
          invalid: 0
        };
      }
      
      validationReport.resultsByKind[kind].total++;
      
      // 检查是否有此类型的 CRD
      let hasCRD = false;
      
      try {
        const isValid = manager.validateCustomResource(resource);
        hasCRD = true;
        
        if (isValid) {
          validationReport.validResources++;
          validationReport.resultsByKind[kind].valid++;
        } else {
          validationReport.invalidResources++;
          validationReport.resultsByKind[kind].invalid++;
          
          const errors = manager.getValidationErrors(resource);
          const formattedErrors = formatValidationErrors(errors);
          
          validationReport.errors.push({
            resource: `${kind}/${name}`,
            errors: formattedErrors
          });
        }
      } catch (error) {
        // 可能是未知的资源类型
        if (!hasCRD) {
          validationReport.unknownResourceKinds++;
          validationReport.errors.push({
            resource: `${kind}/${name}`,
            errors: ['未知的资源类型，没有相应的 CRD 定义']
          });
        } else {
          validationReport.invalidResources++;
          validationReport.resultsByKind[kind].invalid++;
          
          validationReport.errors.push({
            resource: `${kind}/${name}`,
            errors: [`验证过程中发生错误: ${error.message}`]
          });
        }
      }
    }
    
    validationReport.validationTime = Date.now() - startTime;
    
    // 显示验证报告
    console.log(`${colors.cyan}验证报告:${colors.reset}\n`);
    console.log(`总资源数: ${validationReport.totalResources}`);
    console.log(`${colors.green}有效资源: ${validationReport.validResources}${colors.reset}`);
    console.log(`${colors.red}无效资源: ${validationReport.invalidResources}${colors.reset}`);
    console.log(`${colors.yellow}未知资源类型: ${validationReport.unknownResourceKinds}${colors.reset}`);
    console.log(`验证耗时: ${validationReport.validationTime}ms\n`);
    
    console.log(`${colors.cyan}按资源类型统计:${colors.reset}`);
    for (const [kind, stats] of Object.entries(validationReport.resultsByKind)) {
      console.log(`  ${kind}: 共 ${stats.total} 个, ${colors.green}有效 ${stats.valid}${colors.reset}, ${colors.red}无效 ${stats.invalid}${colors.reset}`);
    }
    
    if (validationReport.errors.length > 0) {
      console.log(`\n${colors.red}验证错误:${colors.reset}`);
      for (const { resource, errors } of validationReport.errors) {
        console.log(`\n  ${colors.bright}${resource}:${colors.reset}`);
        errors.forEach(err => {
          console.log(`    - ${err}`);
        });
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
  }
}

/**
 * 运行所有验证示例
 */
async function runValidationExamples() {
  console.log(`${colors.bright}资源验证示例${colors.reset}\n`);
  
  try {
    // 运行 CRD 验证示例并获取管理器实例
    const manager = await demonstrateCRDValidation();
    
    // 使用同一个管理器实例运行其它验证示例
    await demonstrateCustomResourceValidation(manager);
    await demonstrateProgrammaticValidation(manager);
    await demonstrateConditionalValidation(manager);
    await demonstrateBatchValidation(manager);
    
    console.log(`\n${colors.bright}${colors.green}所有验证示例完成!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}未处理的错误:${colors.reset}`, error);
    process.exit(1);
  }
}

// 运行验证示例
runValidationExamples(); 