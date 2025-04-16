/**
 * 全功能 MastraPod 测试脚本
 * 
 * 此脚本展示如何加载和使用 MastraPod 配置
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// 模拟设置环境变量
process.env.OPENAI_API_KEY = 'sk-mock-openai-key';
process.env.ANTHROPIC_API_KEY = 'sk-mock-anthropic-key';
process.env.MEMORY_URL = 'http://localhost:8000';
process.env.DB_USERNAME = 'db_user';
process.env.DB_PASSWORD = 'db_password';
process.env.ENABLE_CUSTOM_TOOLS = 'true';

// 这里应该导入实际的 Mastra Runtime 库
// 注意：下面的导入路径需要根据实际项目结构调整
// const { DSLParser, LLMController } = require('../../dist');

// 自定义的简化解析器用于演示
class SimpleDSLParser {
  constructor() {
    this.resources = [];
    this.includes = [];
    this.config = {};
  }

  async parse(yamlContent) {
    try {
      const parsed = yaml.parse(yamlContent);
      
      // 解析环境变量
      const processedYaml = this._replaceEnvVars(JSON.stringify(parsed));
      const config = JSON.parse(processedYaml);
      
      this.kind = config.kind;
      this.apiVersion = config.apiVersion;
      this.metadata = config.metadata;
      this.spec = config.spec;
      this.resources = config.resources || [];
      this.includes = config.includes || [];
      
      // 处理包含的资源
      await this._processIncludes();
      
      return this;
    } catch (error) {
      console.error('解析 YAML 失败:', error);
      throw error;
    }
  }
  
  async _processIncludes() {
    // 这里应实现处理包含的资源文件
    // 为简化起见，这里只记录包含的路径
    console.log('处理包含的资源:');
    for (const include of this.includes) {
      console.log(`- 路径: ${include.path}, 条件: ${include.when || '无'}, 可选: ${include.optional || false}`);
    }
  }
  
  _replaceEnvVars(content) {
    return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
  
  getResources(kind = null) {
    if (!kind) return this.resources;
    return this.resources.filter(r => r.kind === kind);
  }
  
  getResourceByName(kind, name) {
    return this.resources.find(r => r.kind === kind && r.metadata.name === name);
  }
}

// 执行测试
async function runTest() {
  try {
    console.log('开始测试全功能 MastraPod 配置...');
    
    // 读取 YAML 文件
    const yamlPath = path.join(__dirname, 'mastrapod.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    
    console.log('成功读取 mastrapod.yaml 文件');
    
    // 解析 YAML
    const parser = new SimpleDSLParser();
    await parser.parse(yamlContent);
    
    console.log('\n配置概览:');
    console.log(`- 类型: ${parser.kind}`);
    console.log(`- API 版本: ${parser.apiVersion}`);
    console.log(`- 名称: ${parser.metadata.name}`);
    console.log(`- 描述: ${parser.metadata.description}`);
    
    // 分析资源
    const resourceCounts = {};
    parser.resources.forEach(r => {
      resourceCounts[r.kind] = (resourceCounts[r.kind] || 0) + 1;
    });
    
    console.log('\n资源统计:');
    for (const [kind, count] of Object.entries(resourceCounts)) {
      console.log(`- ${kind}: ${count} 个资源`);
    }
    
    // 检查 LLM 资源
    const llms = parser.getResources('LLM');
    console.log('\nLLM 资源:');
    llms.forEach(llm => {
      console.log(`- ${llm.metadata.name}: ${llm.spec.provider}/${llm.spec.model}`);
    });
    
    // 检查工具资源
    const tools = parser.getResources('Tool');
    console.log('\n工具资源:');
    tools.forEach(tool => {
      console.log(`- ${tool.metadata.name}: ${tool.spec.implementation}`);
      // 检查工具实现文件是否存在
      try {
        const implPath = path.join(__dirname, tool.spec.implementation);
        if (fs.existsSync(implPath)) {
          console.log(`  实现文件已找到: ${implPath}`);
        } else {
          console.log(`  警告: 实现文件不存在: ${implPath}`);
        }
      } catch (err) {
        console.log(`  错误: 检查实现文件失败: ${err.message}`);
      }
    });
    
    // 检查代理资源
    const agents = parser.getResources('Agent');
    console.log('\n代理资源:');
    agents.forEach(agent => {
      console.log(`- ${agent.metadata.name}: 使用 ${agent.spec.llm} 模型`);
      if (agent.spec.tools && agent.spec.tools.length > 0) {
        console.log(`  工具: ${agent.spec.tools.join(', ')}`);
      }
    });
    
    // 检查工作流资源
    const workflows = parser.getResources('Workflow');
    console.log('\n工作流资源:');
    workflows.forEach(workflow => {
      console.log(`- ${workflow.metadata.name}: ${workflow.spec.steps.length} 个步骤`);
      workflow.spec.steps.forEach((step, i) => {
        console.log(`  步骤 ${i+1}: ${step.name} (使用 ${step.agent} 代理)`);
      });
    });
    
    // 检查自定义资源
    const crds = parser.getResources('CustomResourceDefinition');
    console.log('\n自定义资源定义:');
    crds.forEach(crd => {
      console.log(`- ${crd.metadata.name}: 定义 ${crd.spec.names.kind} 类型`);
      // 查找基于此 CRD 创建的资源
      const customResources = parser.resources.filter(r => 
        r.kind === crd.spec.names.kind
      );
      if (customResources.length > 0) {
        console.log(`  已创建 ${customResources.length} 个 ${crd.spec.names.kind} 资源:`);
        customResources.forEach(cr => {
          console.log(`  - ${cr.metadata.name}`);
        });
      }
    });
    
    console.log('\n测试完成!');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
runTest(); 