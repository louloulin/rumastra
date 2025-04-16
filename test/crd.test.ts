import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../src/core/eventbus';
import { CRDController } from '../src/core/crd/controller';
import { createCustomResourceDefinition, CustomResourceDefinition, RuntimeResource } from '../src/types';

describe('CustomResourceDefinition控制器测试', () => {
  let controller: CRDController;
  let eventBus: EventBus;
  let publishSpy: any;
  
  beforeEach(() => {
    eventBus = new EventBus();
    publishSpy = vi.spyOn(eventBus, 'publish');
    controller = new CRDController(eventBus);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('基本CRD处理', () => {
    it('应该成功注册有效的CRD', async () => {
      // 创建测试CRD
      const crd = createTestCRD();
      
      // 协调CRD
      await controller.reconcile(crd);
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith('crd.registered', expect.objectContaining({
        group: 'testing.mastra.ai',
        kind: 'TestResource'
      }));
      
      // 验证状态更新
      expect(crd.status).toBeDefined();
      expect(crd.status?.phase).toBe('Active');
    });
    
    it('应该拒绝无效的CRD定义', async () => {
      // 创建无效的CRD (缺少必要字段)
      const invalidCRD: CustomResourceDefinition = {
        apiVersion: 'mastra.ai/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'invalid-crd'
        },
        spec: {
          group: '', // 无效的空组名
          names: {
            kind: 'InvalidResource',
            plural: 'invalidresources'
          },
          scope: 'Namespaced',
          validation: {
            openAPIV3Schema: {
              // 缺少必要的类型字段
            }
          }
        }
      };
      
      // 协调无效CRD
      await controller.reconcile(invalidCRD);
      
      // 验证失败状态
      expect(invalidCRD.status?.phase).toBe('Failed');
      
      // 验证事件发布 - controller将失败状态作为普通协调事件返回
      expect(publishSpy).toHaveBeenCalledWith('customresourcedefinition.reconciled', expect.objectContaining({
        kind: 'CustomResourceDefinition',
        name: 'invalid-crd'
      }));
    });
    
    it('应该能够清理已注册的CRD', async () => {
      // 创建和注册测试CRD
      const crd = createTestCRD();
      await controller.reconcile(crd);
      
      // 获取已注册的CRD
      expect(controller.getAllRegisteredCRDs()).toHaveLength(1);
      
      // 直接调用清理方法
      await controller.cleanupResource(crd);
      
      // 验证注册表中已移除
      expect(controller.getAllRegisteredCRDs()).toHaveLength(0);
      
      // 验证事件发布
      expect(publishSpy).toHaveBeenCalledWith('crd.removed', expect.objectContaining({
        group: 'testing.mastra.ai',
        kind: 'TestResource'
      }));
    });
  });
  
  describe('自定义资源验证', () => {
    beforeEach(async () => {
      // 注册测试CRD
      const crd = createTestCRD();
      await controller.reconcile(crd);
    });
    
    it('应该验证符合CRD的自定义资源', () => {
      // 创建符合CRD的自定义资源
      const validResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'TestResource',
        metadata: {
          name: 'test-instance',
          namespace: 'default'
        },
        spec: {
          stringField: 'test-value',
          numberField: 42,
          booleanField: true,
          objectField: {
            nestedField: 'nested-value'
          },
          arrayField: ['item1', 'item2']
        }
      };
      
      // 验证自定义资源
      expect(controller.validateCustomResource(validResource)).toBe(true);
    });
    
    it('应该拒绝不符合CRD的自定义资源', () => {
      // 缺少必填字段
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
      
      // 验证自定义资源
      expect(controller.validateCustomResource(invalidResource)).toBe(false);
    });
    
    it('应该拒绝未知类型的自定义资源', () => {
      // 未知的资源类型
      const unknownResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'UnknownResource', // 未注册的类型
        metadata: {
          name: 'unknown-instance'
        },
        spec: {}
      };
      
      // 验证自定义资源
      expect(controller.validateCustomResource(unknownResource)).toBe(false);
    });
  });
  
  describe('高级Schema验证', () => {
    it('应该支持复杂的对象Schema验证', async () => {
      // 创建带有复杂Schema的CRD
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
                  // 带有模式验证的字符串
                  email: {
                    type: 'string',
                    format: 'email'
                  },
                  // 带有范围限制的数字
                  age: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 120
                  },
                  // 带有枚举限制的字符串
                  role: {
                    type: 'string',
                    enum: ['admin', 'user', 'guest']
                  },
                  // 嵌套对象
                  address: {
                    type: 'object',
                    properties: {
                      street: { type: 'string' },
                      city: { type: 'string' },
                      zipCode: { type: 'string', pattern: '^\\d{5}$' }
                    },
                    required: ['street', 'city']
                  },
                  // 带有项目验证的数组
                  tags: {
                    type: 'array',
                    items: {
                      type: 'string',
                      minLength: 2,
                      maxLength: 10
                    },
                    minItems: 1
                  }
                },
                required: ['email', 'role']
              }
            }
          }
        }
      });
      
      // 注册CRD
      await controller.reconcile(complexCRD);
      
      // 创建有效的复杂资源
      const validComplexResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'ComplexResource',
        metadata: {
          name: 'valid-complex'
        },
        spec: {
          email: 'test@example.com',
          age: 30,
          role: 'admin',
          address: {
            street: 'Test Street',
            city: 'Test City',
            zipCode: '12345'
          },
          tags: ['tag1', 'tag2']
        }
      };
      
      // 验证有效资源
      expect(controller.validateCustomResource(validComplexResource)).toBe(true);
      
      // 创建无效的复杂资源 (无效的email)
      const invalidEmailResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'ComplexResource',
        metadata: {
          name: 'invalid-email'
        },
        spec: {
          email: 'not-an-email', // 无效的email
          role: 'admin'
        }
      };
      
      // 验证无效资源
      expect(controller.validateCustomResource(invalidEmailResource)).toBe(false);
      
      // 创建无效的复杂资源 (无效的角色)
      const invalidRoleResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'ComplexResource',
        metadata: {
          name: 'invalid-role'
        },
        spec: {
          email: 'test@example.com',
          role: 'manager' // 不在枚举中
        }
      };
      
      // 验证无效资源
      expect(controller.validateCustomResource(invalidRoleResource)).toBe(false);
    });
    
    it('应该支持带有additionalProperties的Schema', async () => {
      // 创建带有additionalProperties的CRD
      const extensibleCRD = createCustomResourceDefinition('extensible.testing.mastra.ai', {
        group: 'testing.mastra.ai',
        names: {
          kind: 'ExtensibleResource',
          plural: 'extensibleresources'
        },
        scope: 'Namespaced',
        validation: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                },
                required: ['name'],
                additionalProperties: true // 允许额外字段
              }
            }
          }
        }
      });
      
      // 注册CRD
      await controller.reconcile(extensibleCRD);
      
      // 创建带有额外字段的资源
      const extensibleResource: RuntimeResource = {
        apiVersion: 'testing.mastra.ai/v1',
        kind: 'ExtensibleResource',
        metadata: {
          name: 'extensible-instance'
        },
        spec: {
          name: 'required-name',
          // 额外字段
          extraString: 'extra-value',
          extraNumber: 123,
          extraObject: {
            nested: true
          }
        }
      };
      
      // 验证资源 (应当通过)
      expect(controller.validateCustomResource(extensibleResource)).toBe(true);
    });
  });
});

// 辅助函数：创建测试CRD
function createTestCRD(): CustomResourceDefinition {
  return createCustomResourceDefinition('testresources.testing.mastra.ai', {
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
              booleanField: { type: 'boolean' },
              objectField: {
                type: 'object',
                properties: {
                  nestedField: { type: 'string' }
                }
              },
              arrayField: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['stringField']
          }
        }
      }
    }
  });
} 