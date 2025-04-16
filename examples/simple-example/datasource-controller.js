/**
 * 示例数据源控制器
 * 
 * 这是一个简化的控制器示例，仅用于处理DataSource资源
 */

// 导出控制器类
export class DataSourceController {
  constructor() {
    this.dataSources = new Map();
  }

  /**
   * 控制器名称
   */
  static get name() {
    return 'DataSourceController';
  }

  /**
   * 处理的资源类型
   */
  static get resourceKind() {
    return 'DataSource';
  }

  /**
   * 获取数据源状态
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   */
  getStatus(name, namespace = 'default') {
    const key = `${namespace}.${name}`;
    const ds = this.dataSources.get(key);
    
    if (!ds) {
      return {
        status: 'NotFound',
        message: '数据源未找到'
      };
    }
    
    return {
      status: 'Ready',
      url: ds.spec.url,
      type: ds.spec.type,
      message: '数据源已连接'
    };
  }

  /**
   * 添加数据源资源
   * @param {object} resource 数据源资源
   */
  async addResource(resource) {
    const name = resource.metadata.name;
    const namespace = resource.metadata.namespace || 'default';
    const key = `${namespace}.${name}`;
    
    // 检查meta字段有效性
    if (!this._validateResourceMetadata(resource)) {
      console.log(`[DataSourceController] 资源缺少有效的元数据: ${name}`);
      resource.metadata = resource.metadata || {};
      resource.metadata.namespace = resource.metadata.namespace || 'default';
      resource.metadata.name = resource.metadata.name || `unknown-${Date.now()}`;
    }
    
    console.log(`[DataSourceController] 注册数据源 ${namespace}/${name}`);
    this.dataSources.set(key, resource);
    return true;
  }

  /**
   * 更新数据源资源
   * @param {object} resource 数据源资源
   */
  async updateResource(resource) {
    return this.addResource(resource);
  }

  /**
   * 删除数据源资源
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   */
  async deleteResource(name, namespace = 'default') {
    const key = `${namespace}.${name}`;
    console.log(`[DataSourceController] 删除数据源 ${namespace}/${name}`);
    return this.dataSources.delete(key);
  }

  /**
   * 验证资源元数据
   * @param {object} resource 数据源资源
   * @private
   */
  _validateResourceMetadata(resource) {
    return (
      resource &&
      resource.metadata &&
      typeof resource.metadata === 'object' &&
      resource.metadata.name &&
      typeof resource.metadata.name === 'string'
    );
  }
}

// 导出一个创建控制器的工厂函数
export function createDataSourceController() {
  return new DataSourceController();
} 