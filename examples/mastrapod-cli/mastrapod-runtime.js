/**
 * MastraPod 运行时封装类
 * 使用rumastra实际API替代本地模拟实现
 */

const { MastraPod } = require('rumastra');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 确保资源目录存在
const RESOURCES_DIR = path.join(process.cwd(), '.mastrapod', 'resources');
fs.mkdirSync(RESOURCES_DIR, { recursive: true });

/**
 * 生成唯一ID
 * @returns {string} UUID
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * MastraPod运行时封装类
 * 提供资源管理、状态存储和执行功能
 */
class MastraPodRuntime {
  constructor() {
    this.runtimeId = generateId();
    this.resources = {
      agents: {},
      tools: {},
      workflows: {},
      networks: {}
    };
    this.resourceNamespaces = {};
    this.mastraPod = null;
    
    console.log(`创建MastraPod实例, ID: ${this.runtimeId}`);
  }
  
  /**
   * 初始化MastraPod运行时
   */
  async initialize() {
    try {
      // 创建MastraPod实例
      this.mastraPod = new MastraPod({
        id: this.runtimeId,
        enableLogging: true,
      });
      
      // 检查MastraPod实例的可用方法
      console.log('MastraPod 实例可用方法:');
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.mastraPod))
        .filter(name => typeof this.mastraPod[name] === 'function' && name !== 'constructor');
      console.log(methods);
      
      // 注册控制器
      await this._registerControllers();
      
      // 加载已存在的资源
      await this._loadExistingResources();
      
      console.log('MastraPod 运行时已初始化');
      return true;
    } catch (error) {
      console.error('初始化MastraPod运行时失败:', error);
      return false;
    }
  }
  
  /**
   * 注册资源控制器
   */
  async _registerControllers() {
    try {
      // 注册内置资源控制器
      const resourceKinds = [
        'CustomResourceDefinition',
        'Network',
        'Workflow',
        'LLM',
        'Tool',
        'Agent'
      ];
      
      for (const kind of resourceKinds) {
        // 注册控制器
        if (this.mastraPod.registerController) {
          await this.mastraPod.registerController(kind);
          console.log(`Controller registered for resource kind: ${kind}`);
        }
      }
    } catch (error) {
      console.error('注册资源控制器失败:', error);
    }
  }
  
  /**
   * 加载已存在的资源
   * @returns {Promise<void>}
   */
  async _loadExistingResources() {
    try {
      // 从文件系统加载资源
      const resourceFiles = this._getResourceFiles();
      
      // 遍历资源文件并加载
      for (const file of resourceFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const resourceData = yaml.load(content);
          
          if (resourceData && resourceData.kind && resourceData.metadata) {
            const kind = resourceData.kind.toLowerCase() + 's';
            const name = resourceData.metadata.name;
            const namespace = resourceData.metadata.namespace || 'default';
            
            // 设置资源
            await this.setResource(kind, name, namespace, resourceData);
            console.log(`资源已添加: ${kind}/${name} 在命名空间 ${namespace}`);
          }
        } catch (err) {
          console.error(`加载资源文件 ${file} 失败:`, err);
        }
      }
      
      console.log('已加载现有资源到运行时');
    } catch (error) {
      console.error('加载现有资源失败:', error);
    }
  }
  
  /**
   * 获取所有资源文件
   * @returns {string[]} 资源文件路径列表
   */
  _getResourceFiles() {
    const files = [];
    
    try {
      const resourcesDir = path.join(process.cwd(), '.mastrapod', 'resources');
      if (fs.existsSync(resourcesDir)) {
        const readDir = (dir) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
              readDir(itemPath);
            } else if (itemPath.endsWith('.yaml') || itemPath.endsWith('.yml')) {
              files.push(itemPath);
            }
          }
        };
        
        readDir(resourcesDir);
      }
    } catch (error) {
      console.error('获取资源文件列表失败:', error);
    }
    
    return files;
  }
  
  /**
   * 获取资源列表
   * @param {string} resourceType 资源类型
   * @param {string} namespace 命名空间
   * @returns {Array} 资源列表
   */
  async getResources(resourceType, namespace = 'default') {
    try {
      let resources = [];
      
      // 尝试从本地缓存获取资源
      if (this.resources[resourceType] && this.resources[resourceType][namespace]) {
        resources = Object.values(this.resources[resourceType][namespace]);
      }
      
      return resources;
    } catch (error) {
      console.error(`获取 ${resourceType} 资源列表失败:`, error);
      throw error;
    }
  }
  
  /**
   * 获取特定资源
   * @param {string} resourceType 资源类型
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   * @returns {object|null} 资源对象
   */
  async getResource(resourceType, name, namespace = 'default') {
    try {
      // 尝试从本地缓存获取资源
      if (this.resources[resourceType] && 
          this.resources[resourceType][namespace] && 
          this.resources[resourceType][namespace][name]) {
        return this.resources[resourceType][namespace][name];
      }

      // 资源不存在
      return null;
    } catch (error) {
      console.error(`获取资源 ${resourceType} "${name}" 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 设置资源
   * @param {string} resourceType 资源类型
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   * @param {object} resource 资源对象
   * @returns {boolean} 是否成功
   */
  async setResource(resourceType, name, namespace = 'default', resource) {
    try {
      // 确保命名空间存在
      if (!this.resources[resourceType]) {
        this.resources[resourceType] = {};
      }
      
      if (!this.resources[resourceType][namespace]) {
        this.resources[resourceType][namespace] = {};
      }
      
      // 设置资源
      this.resources[resourceType][namespace][name] = resource;
      this.resourceNamespaces[`${resourceType}.${name}`] = namespace;
      
      // 添加时间戳
      if (!resource.metadata.creationTimestamp) {
        resource.metadata.creationTimestamp = new Date().toISOString();
      }
      
      // 存储资源到文件
      this._saveResourceToFile(resourceType, name, namespace, resource);
      
      // 向运行时添加资源
      if (this.mastraPod && this.mastraPod.addResource) {
        try {
          const singularType = resourceType.endsWith('s') 
            ? resourceType.slice(0, -1) 
            : resourceType;
          
          await this.mastraPod.addResource({
            kind: singularType.charAt(0).toUpperCase() + singularType.slice(1),
            ...resource
          });
        } catch (err) {
          console.warn(`注册资源到运行时失败: ${err.message}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`设置资源 ${resourceType} "${name}" 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 将资源保存到文件
   * @param {string} resourceType 资源类型
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   * @param {object} resource 资源对象
   */
  _saveResourceToFile(resourceType, name, namespace, resource) {
    try {
      // 创建命名空间目录
      const namespaceDir = path.join(RESOURCES_DIR, namespace);
      if (!fs.existsSync(namespaceDir)) {
        fs.mkdirSync(namespaceDir, { recursive: true });
      }
      
      // 创建资源类型目录
      const resourceTypeDir = path.join(namespaceDir, resourceType);
      if (!fs.existsSync(resourceTypeDir)) {
        fs.mkdirSync(resourceTypeDir, { recursive: true });
      }
      
      // 保存资源文件
      const filePath = path.join(resourceTypeDir, `${name}.yaml`);
      fs.writeFileSync(filePath, yaml.dump(resource));
    } catch (error) {
      console.error(`保存资源 ${resourceType} "${name}" 到文件失败:`, error);
    }
  }
  
  /**
   * 删除资源
   * @param {string} resourceType 资源类型
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   * @returns {boolean} 是否成功
   */
  async deleteResource(resourceType, name, namespace = 'default') {
    try {
      // 检查资源是否存在
      if (!this.resources[resourceType] || 
          !this.resources[resourceType][namespace] || 
          !this.resources[resourceType][namespace][name]) {
        return false;
      }
      
      // 从运行时删除资源
      if (this.mastraPod && this.mastraPod.removeResource) {
        try {
          const singularType = resourceType.endsWith('s') 
            ? resourceType.slice(0, -1) 
            : resourceType;
          
          await this.mastraPod.removeResource({
            kind: singularType.charAt(0).toUpperCase() + singularType.slice(1),
            metadata: {
              name,
              namespace
            }
          });
        } catch (err) {
          console.warn(`从运行时删除资源失败: ${err.message}`);
        }
      }
      
      // 删除资源
      delete this.resources[resourceType][namespace][name];
      delete this.resourceNamespaces[`${resourceType}.${name}`];
      
      // 删除资源文件
      this._deleteResourceFile(resourceType, name, namespace);
      
      return true;
    } catch (error) {
      console.error(`删除资源 ${resourceType} "${name}" 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 删除资源文件
   * @param {string} resourceType 资源类型
   * @param {string} name 资源名称
   * @param {string} namespace 命名空间
   */
  _deleteResourceFile(resourceType, name, namespace) {
    try {
      const filePath = path.join(RESOURCES_DIR, namespace, resourceType, `${name}.yaml`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`删除资源文件失败:`, error);
    }
  }
  
  /**
   * 执行工具函数
   * @param {string} toolName 工具名称
   * @param {string} functionName 函数名称
   * @param {object} params 参数
   * @returns {Promise<any>} 执行结果
   */
  async executeTool(toolName, functionName, params = {}) {
    try {
      console.log(`调用工具 ${toolName} 的函数 ${functionName}...`);
      
      // 获取工具资源
      const namespace = this.resourceNamespaces[`tools.${toolName}`] || 'default';
      const toolResource = await this.getResource('tools', toolName, namespace);
      
      if (!toolResource) {
        throw new Error(`工具 "${toolName}" 不存在`);
      }
      
      console.log(`调用工具 "${toolName}" 的函数 "${functionName}"，参数:`, params);
      
      // 使用真实MastraPod实例执行工具
      if (!this.mastraPod.callTool) {
        throw new Error(`MastraPod 实例不支持 callTool 方法`);
      }
      
      const result = await this.mastraPod.callTool(toolName, functionName, params);
      return result;
    } catch (error) {
      console.error(`执行工具函数 ${toolName}.${functionName} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 执行智能体
   * @param {string} agentName 智能体名称
   * @param {string} input 输入文本
   * @returns {Promise<any>} 执行结果
   */
  async executeAgent(agentName, input) {
    try {
      console.log(`执行 Agent "${agentName}"，输入: "${input}"`);
      
      // 获取智能体资源
      const namespace = this.resourceNamespaces[`agents.${agentName}`] || 'default';
      const agentResource = await this.getResource('agents', agentName, namespace);
      
      if (!agentResource) {
        throw new Error(`智能体 "${agentName}" 不存在`);
      }
      
      // 使用真实MastraPod实例执行代理
      if (!this.mastraPod.runAgent) {
        throw new Error(`MastraPod 实例不支持 runAgent 方法`);
      }
      
      const result = await this.mastraPod.runAgent(agentName, { input });
      return result;
    } catch (error) {
      console.error(`执行智能体 ${agentName} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 执行工作流
   * @param {string} workflowName 工作流名称
   * @param {object} params 工作流参数
   * @returns {Promise<any>} 执行结果
   */
  async executeWorkflow(workflowName, params = {}) {
    try {
      console.log(`执行 Workflow "${workflowName}"，参数:`, params);
      
      // 获取工作流资源
      const namespace = this.resourceNamespaces[`workflows.${workflowName}`] || 'default';
      const workflowResource = await this.getResource('workflows', workflowName, namespace);
      
      if (!workflowResource) {
        throw new Error(`工作流 "${workflowName}" 不存在`);
      }
      
      // 使用真实MastraPod实例执行工作流
      if (!this.mastraPod.runWorkflow) {
        throw new Error(`MastraPod 实例不支持 runWorkflow 方法`);
      }
      
      const result = await this.mastraPod.runWorkflow(workflowName, params);
      return result;
    } catch (error) {
      console.error(`执行工作流 ${workflowName} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 执行网络
   * @param {string} networkName 网络名称
   * @param {string} input 输入文本
   * @returns {Promise<any>} 执行结果
   */
  async executeNetwork(networkName, input) {
    try {
      console.log(`执行 Network "${networkName}"，输入: "${input}"`);
      
      // 获取网络资源
      const namespace = this.resourceNamespaces[`networks.${networkName}`] || 'default';
      const networkResource = await this.getResource('networks', networkName, namespace);
      
      if (!networkResource) {
        throw new Error(`网络 "${networkName}" 不存在`);
      }
      
      // MastraPod 目前不直接支持执行网络
      // 我们需要看看网络定义，然后执行其中的代理
      if (networkResource.spec && networkResource.spec.agents && networkResource.spec.agents.length > 0) {
        const agents = networkResource.spec.agents;
        const agentContributions = [];
        
        // 按序执行网络中的所有代理
        for (const agent of agents) {
          try {
            if (typeof agent === 'string') {
              const result = await this.executeAgent(agent, input);
              agentContributions.push({
                agent,
                contribution: result.response || (result.content ? result.content.response : "无响应")
              });
            } else if (agent.name) {
              const result = await this.executeAgent(agent.name, input);
              agentContributions.push({
                agent: agent.name,
                contribution: result.response || (result.content ? result.content.response : "无响应")
              });
            }
          } catch (err) {
            console.warn(`网络中的代理 ${agent} 执行失败:`, err);
            agentContributions.push({
              agent: typeof agent === 'string' ? agent : agent.name,
              contribution: `执行失败: ${err.message}`
            });
          }
        }
        
        return {
          network: networkName,
          input,
          response: `来自 ${networkName} 的响应，基于 ${agents.length} 个代理的贡献。`,
          agentContributions,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(`网络 "${networkName}" 定义不完整，缺少代理列表`);
      }
    } catch (error) {
      console.error(`执行网络 ${networkName} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 获取执行历史
   * @param {number} limit 限制数量
   * @returns {Promise<Array>} 执行历史记录
   */
  async getExecutions(limit = 10) {
    try {
      // 目前MastraPod实例不支持getExecutions方法，返回模拟数据
      console.log('返回本地模拟的执行历史记录...');
      
      // 模拟数据
      const mockExecutions = [
        {
          id: this._generateId(),
          type: 'agent',
          name: 'task-assistant',
          input: '任务管理查询',
          status: 'completed',
          timestamp: new Date(Date.now() - 300000).toISOString()
        },
        {
          id: this._generateId(),
          type: 'tool',
          name: 'task-manager.createTask',
          params: { title: '示例任务', priority: 'high' },
          status: 'completed',
          timestamp: new Date(Date.now() - 200000).toISOString()
        },
        {
          id: this._generateId(),
          type: 'workflow',
          name: 'task-processing-workflow',
          params: { title: '工作流任务', priority: 'medium' },
          status: 'completed',
          timestamp: new Date(Date.now() - 100000).toISOString()
        },
        {
          id: this._generateId(),
          type: 'network',
          name: 'task-management-network',
          input: '任务规划建议',
          status: 'completed',
          timestamp: new Date().toISOString()
        }
      ];
      
      return mockExecutions.slice(0, limit);
    } catch (error) {
      console.error('获取执行历史失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成唯一ID
   * @returns {string} UUID
   */
  _generateId() {
    return 'exec-' + Date.now().toString() + '-' + Math.random().toString(36).substring(2, 8);
  }
}

module.exports = { MastraPodRuntime }; 