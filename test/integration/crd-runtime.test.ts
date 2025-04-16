import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuntimeManager } from '../../src/core/runtime-manager';
import { createCustomResourceDefinition, RuntimeResource } from '../../src/types';

describe('CRD与RuntimeManager集成测试', () => {
  let manager: RuntimeManager;
  
  beforeEach(() => {
    manager = new RuntimeManager();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('应该能够通过RuntimeManager注册CRD', async () => {
    // 创建测试CRD
    const crd = createCustomResourceDefinition('testresources.testing.mastra.ai', {
      group: 'testing.mastra.ai',
      names: {
        kind: 'TestResource',
        plural: 'testresources'
      },
      scope: 'Namespaced',
      validation: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            spec: {
              type: 'object',
              properties: {
                stringField: { type: 'string' },
                numberField: { type: 'number' },
                booleanField: { type: 'boolean' }
              },
              required: ['stringField']
            }
          }
        }
      }
    });
    
    // 监听CRD注册事件
    const registeredHandler = vi.fn();
    manager.on('crd:registered', registeredHandler);
    
    // 添加CRD资源
    await manager.addResource(crd);
    
    // 验证事件被触发
    expect(registeredHandler).toHaveBeenCalledWith(expect.objectContaining({
      group: 'testing.mastra.ai',
      kind: 'TestResource'
    }));
    
    // 创建一个有效的自定义资源
    const validResource: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'TestResource',
      metadata: {
        name: 'test-instance'
      },
      spec: {
        stringField: 'test-value',
        numberField: 42
      }
    };
    
    // 验证自定义资源
    expect(manager.validateCustomResource(validResource)).toBe(true);
    expect(manager.getCustomResourceValidationErrors(validResource)).toBeNull();
    
    // 创建一个无效的自定义资源 (缺少必填字段)
    const invalidResource: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'TestResource',
      metadata: {
        name: 'invalid-instance'
      },
      spec: {
        // 缺少stringField (必填)
        numberField: 42
      }
    };
    
    // 验证无效资源会被拒绝
    expect(manager.validateCustomResource(invalidResource)).toBe(false);
    expect(manager.getCustomResourceValidationErrors(invalidResource)).not.toBeNull();
  });
  
  it('应该能够处理复杂类型的CRD验证', async () => {
    // 创建具有复杂验证规则的CRD
    const complexCRD = createCustomResourceDefinition('complexresources.testing.mastra.ai', {
      group: 'testing.mastra.ai',
      names: {
        kind: 'ComplexResource',
        plural: 'complexresources'
      },
      scope: 'Namespaced',
      validation: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            spec: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email'
                },
                age: {
                  type: 'integer',
                  minimum: 18,
                  maximum: 120
                },
                role: {
                  type: 'string',
                  enum: ['admin', 'user', 'guest']
                },
                tags: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  uniqueItems: true,
                  minItems: 1
                },
                config: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    timeout: { type: 'integer' }
                  },
                  required: ['enabled']
                }
              },
              required: ['email', 'role']
            }
          }
        }
      }
    });
    
    // 添加CRD资源
    await manager.addResource(complexCRD);
    
    // 创建有效资源
    const validResource: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'complex-valid'
      },
      spec: {
        email: 'test@example.com',
        age: 30,
        role: 'admin',
        tags: ['tag1', 'tag2'],
        config: {
          enabled: true,
          timeout: 5000
        }
      }
    };
    
    // 验证有效资源
    expect(manager.validateCustomResource(validResource)).toBe(true);
    
    // 无效情况1：无效的email格式
    const invalidEmail: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'invalid-email'
      },
      spec: {
        email: 'not-an-email',  // 无效格式
        role: 'admin',
        tags: ['tag1']
      }
    };
    
    expect(manager.validateCustomResource(invalidEmail)).toBe(false);
    
    // 无效情况2：age超出范围
    const invalidAge: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'invalid-age'
      },
      spec: {
        email: 'test@example.com',
        age: 15,  // 小于最小值18
        role: 'admin',
        tags: ['tag1']
      }
    };
    
    expect(manager.validateCustomResource(invalidAge)).toBe(false);
    
    // 无效情况3：role不在枚举中
    const invalidRole: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'invalid-role'
      },
      spec: {
        email: 'test@example.com',
        role: 'manager',  // 不在枚举中
        tags: ['tag1']
      }
    };
    
    expect(manager.validateCustomResource(invalidRole)).toBe(false);
    
    // 无效情况4：tags重复项
    const invalidTags: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'invalid-tags'
      },
      spec: {
        email: 'test@example.com',
        role: 'admin',
        tags: ['tag1', 'tag1']  // 重复项
      }
    };
    
    expect(manager.validateCustomResource(invalidTags)).toBe(false);
    
    // 无效情况5：缺少config.enabled
    const invalidConfig: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'ComplexResource',
      metadata: {
        name: 'invalid-config'
      },
      spec: {
        email: 'test@example.com',
        role: 'admin',
        tags: ['tag1'],
        config: {
          // 缺少required字段enabled
          timeout: 5000
        }
      }
    };
    
    expect(manager.validateCustomResource(invalidConfig)).toBe(false);
  });
  
  it('应该能够在删除CRD后拒绝验证对应的自定义资源', async () => {
    // 创建并添加测试CRD
    const crd = createCustomResourceDefinition('deletetest.testing.mastra.ai', {
      group: 'testing.mastra.ai',
      names: {
        kind: 'DeleteTest',
        plural: 'deletetests'
      },
      scope: 'Namespaced',
      validation: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            spec: {
              type: 'object',
              properties: {
                test: { type: 'string' }
              }
            }
          }
        }
      }
    });
    
    await manager.addResource(crd);
    
    // 创建一个自定义资源
    const customResource: RuntimeResource = {
      apiVersion: 'testing.mastra.ai/v1',
      kind: 'DeleteTest',
      metadata: {
        name: 'delete-test'
      },
      spec: {
        test: 'value'
      }
    };
    
    // 验证资源有效
    expect(manager.validateCustomResource(customResource)).toBe(true);
    
    // 监听CRD移除事件
    const removedHandler = vi.fn();
    manager.on('crd:removed', removedHandler);
    
    // 通过控制器清理资源
    await manager.getController('CustomResourceDefinition').reconcile({
      ...crd,
      metadata: {
        ...crd.metadata,
        deletionTimestamp: new Date().toISOString()
      }
    });
    
    // 验证事件被触发
    expect(removedHandler).toHaveBeenCalledWith(expect.objectContaining({
      group: 'testing.mastra.ai',
      kind: 'DeleteTest'
    }));
    
    // 验证自定义资源现在无效
    expect(manager.validateCustomResource(customResource)).toBe(false);
    expect(manager.getCustomResourceValidationErrors(customResource)).not.toBeNull();
  });
}); 