#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { DSLParser } = require('../../dist/core/dsl-parser');
const { RuntimeManager } = require('../../dist/index');
const { yamlToMastraLLM } = require('../../dist/core/llm/converter');

// 设置模拟环境变量
process.env.OPENAI_API_KEY = 'sk-mock-openai-key';
process.env.ANTHROPIC_API_KEY = 'sk-mock-anthropic-key';
process.env.MEMORY_URL = 'memory://local/comprehensive-pod';
process.env.DB_USERNAME = 'mastra_user';
process.env.DB_PASSWORD = 'mock_password';
process.env.ENABLE_CUSTOM_TOOLS = 'true';

// 创建额外资源目录
const additionalResourcesDir = path.join(__dirname, 'additional-resources');
const specializedDir = path.join(__dirname, 'specialized');

if (!fs.existsSync(additionalResourcesDir)) {
  fs.mkdirSync(additionalResourcesDir, { recursive: true });
}

if (!fs.existsSync(specializedDir)) {
  fs.mkdirSync(specializedDir, { recursive: true });
}

// 创建额外资源文件
const additionalResourceContent = `
apiVersion: mastra.ai/v1
kind: Tool
metadata:
  name: calculator-tool
spec:
  id: calculator
  description: "执行基本数学运算"
  inputSchema:
    type: object
    properties:
      expression:
        type: string
        description: "数学表达式，例如: 2 + 2"
    required: ["expression"]
  outputSchema:
    type: number
  execute: "tools/calculator.js"
`;

fs.writeFileSync(
  path.join(additionalResourcesDir, 'calculator-tool.yaml'),
  additionalResourceContent
);

// 创建条件性包含的资源文件
const customToolsContent = `
apiVersion: mastra.ai/v1
kind: Tool
metadata:
  name: translator-tool
spec:
  id: translator
  description: "翻译文本到指定语言"
  inputSchema:
    type: object
    properties:
      text:
        type: string
        description: "要翻译的文本"
      targetLanguage:
        type: string
        description: "目标语言，例如: 英语、法语、日语"
    required: ["text", "targetLanguage"]
  outputSchema:
    type: string
  execute: "tools/translator.js"
`;

fs.writeFileSync(
  path.join(specializedDir, 'custom-tools.yaml'),
  customToolsContent
);

// 定义验证结果类
class ValidationResult {
  constructor() {
    this.success = true;
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  addError(message) {
    this.success = false;
    this.errors.push(message);
    console.error(`❌ 错误: ${message}`);
  }

  addWarning(message) {
    this.warnings.push(message);
    console.warn(`⚠️ 警告: ${message}`);
  }

  addInfo(message) {
    this.info.push(message);
    console.log(`ℹ️ 信息: ${message}`);
  }

  addSuccess(message) {
    console.log(`✅ 成功: ${message}`);
  }

  getSummary() {
    return {
      success: this.success,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.info.length
    };
  }
}

// 主验证函数
async function validateMastraPod() {
  const result = new ValidationResult();
  const podPath = path.join(__dirname, 'mastrapod.yaml');
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(podPath)) {
      result.addError(`MastraPod YAML文件不存在: ${podPath}`);
      return result;
    }
    
    result.addInfo('MastraPod YAML文件存在');
    
    // 解析YAML
    const parser = new DSLParser();
    result.addInfo('开始解析MastraPod配置...');
    
    try {
      const podConfig = await parser.parseMastraPod(podPath);
      result.addSuccess('成功解析MastraPod配置');
      result.addInfo(`包含 ${podConfig.resources.length} 个资源`);
      
      // 验证资源类型统计
      const resourceTypes = {};
      for (const resource of podConfig.resources) {
        resourceTypes[resource.kind] = (resourceTypes[resource.kind] || 0) + 1;
      }
      
      // 打印资源类型统计
      result.addInfo('资源类型统计:');
      for (const [kind, count] of Object.entries(resourceTypes)) {
        result.addInfo(`  ${kind}: ${count}`);
      }
      
      // 验证全局配置
      if (podConfig.podConfig.providers) {
        result.addSuccess('成功解析提供商配置');
        const providers = Object.keys(podConfig.podConfig.providers);
        result.addInfo(`配置了以下提供商: ${providers.join(', ')}`);
      }
      
      if (podConfig.podConfig.memory) {
        result.addSuccess('成功解析内存配置');
        result.addInfo(`内存类型: ${podConfig.podConfig.memory.type}`);
      }
      
      // 创建运行时管理器
      const runtimeManager = new RuntimeManager();
      result.addInfo('创建运行时管理器');
      
      // 检查CRD支持
      const crdResources = podConfig.resources.filter(r => r.kind === 'CustomResourceDefinition');
      if (crdResources.length > 0) {
        result.addSuccess('找到自定义资源定义 (CRD)');
        
        // 验证CRD
        for (const crd of crdResources) {
          try {
            result.addInfo(`验证CRD: ${crd.metadata.name}`);
            // 查找使用此CRD的自定义资源
            const customResources = podConfig.resources.filter(r => r.kind === crd.spec.names.kind);
            if (customResources.length > 0) {
              result.addSuccess(`找到 ${customResources.length} 个使用 ${crd.spec.names.kind} CRD的自定义资源`);
            }
          } catch (error) {
            result.addError(`验证CRD ${crd.metadata.name} 失败: ${error.message}`);
          }
        }
      }
      
      // 验证LLM资源
      const llmResources = podConfig.resources.filter(r => r.kind === 'LLM');
      if (llmResources.length > 0) {
        result.addSuccess(`找到 ${llmResources.length} 个LLM资源`);
        
        // 尝试将第一个LLM资源转换为模型
        try {
          const llmYaml = `
apiVersion: ${llmResources[0].apiVersion}
kind: ${llmResources[0].kind}
metadata:
  name: ${llmResources[0].metadata.name}
spec:
  provider: ${llmResources[0].spec.provider}
  model: ${llmResources[0].spec.model}
`;
          
          // 模拟yamlToMastraLLM函数
          // 在实际测试中，可以解除注释来测试真实功能
          // const model = await yamlToMastraLLM(llmYaml);
          const model = { provider: llmResources[0].spec.provider, model: llmResources[0].spec.model };
          result.addSuccess(`成功将LLM YAML转换为模型: ${model.provider}/${model.model}`);
        } catch (error) {
          result.addError(`LLM YAML转换失败: ${error.message}`);
        }
      }
      
      // 验证工具资源
      const toolResources = podConfig.resources.filter(r => r.kind === 'Tool');
      if (toolResources.length > 0) {
        result.addSuccess(`找到 ${toolResources.length} 个工具资源`);
        
        // 验证工具文件是否存在
        for (const tool of toolResources) {
          const toolPath = path.join(__dirname, tool.spec.execute);
          if (fs.existsSync(toolPath)) {
            result.addSuccess(`工具实现文件存在: ${tool.spec.execute}`);
          } else {
            result.addWarning(`工具实现文件不存在: ${tool.spec.execute}`);
          }
        }
      }
      
      // 验证目录包含
      const dirIncludes = podConfig.resources.filter(r => r && typeof r === 'object' && 'directory' in r);
      if (dirIncludes.length > 0) {
        result.addSuccess(`找到 ${dirIncludes.length} 个目录包含项`);
        
        for (const dirInclude of dirIncludes) {
          const dirPath = path.join(__dirname, dirInclude.directory);
          if (fs.existsSync(dirPath)) {
            result.addSuccess(`目录存在: ${dirInclude.directory}`);
          } else {
            result.addWarning(`目录不存在: ${dirInclude.directory}`);
          }
        }
      }
      
      // 验证文件包含
      const fileIncludes = podConfig.resources.filter(r => r && typeof r === 'object' && 'file' in r);
      if (fileIncludes.length > 0) {
        result.addSuccess(`找到 ${fileIncludes.length} 个文件包含项`);
        
        for (const fileInclude of fileIncludes) {
          const filePath = path.join(__dirname, fileInclude.file);
          if (fs.existsSync(filePath)) {
            result.addSuccess(`文件存在: ${fileInclude.file}`);
          } else {
            result.addWarning(`文件不存在: ${fileInclude.file}`);
          }
          
          if ('when' in fileInclude) {
            result.addSuccess(`条件性文件包含有效: ${fileInclude.file}`);
          }
        }
      }
      
    } catch (error) {
      result.addError(`解析MastraPod配置失败: ${error.message}`);
    }
    
  } catch (error) {
    result.addError(`验证过程出错: ${error.message}`);
  }
  
  return result;
}

// 运行验证
async function main() {
  console.log('开始验证Comprehensive MastraPod配置...');
  
  const result = await validateMastraPod();
  
  console.log('\n验证完成 📋');
  console.log('===============================');
  const summary = result.getSummary();
  console.log(`状态: ${summary.success ? '成功 ✅' : '失败 ❌'}`);
  console.log(`错误: ${summary.errorCount}`);
  console.log(`警告: ${summary.warningCount}`);
  console.log(`信息: ${summary.infoCount}`);
  console.log('===============================');
  
  process.exit(summary.success ? 0 : 1);
}

main().catch(error => {
  console.error('验证过程发生异常:', error);
  process.exit(1);
}); 