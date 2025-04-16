#!/usr/bin/env node

/**
 * MastraPod CLI - 命令行工具
 * 支持类似 kubectl 的方式管理和执行 Mastra 资源
 * 使用真实的 rumastra 运行时
 */

const { program } = require('commander');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { table } = require('table');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const { MastraPodRuntime } = require('./mastrapod-runtime');

// 创建运行时实例
const runtime = new MastraPodRuntime();

// 定义版本号和描述
program
  .name('mastrapod')
  .description('MastraPod 命令行工具 - 管理和运行 Mastra 资源')
  .version('0.1.0');

// 全局选项
program
  .option('-n, --namespace <namespace>', '指定命名空间', 'default')
  .option('-o, --output <format>', '输出格式 (json, yaml, table)', 'table')
  .option('-v, --verbose', '详细输出模式')
  .hook('preAction', async (thisCommand) => {
    try {
      // 初始化运行时
      await runtime.initialize();
    } catch (error) {
      console.error(chalk.red(`初始化运行时失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 辅助函数: 格式化输出
function formatOutput(data, outputFormat) {
  switch (outputFormat) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.dump(data);
    case 'table':
      if (Array.isArray(data)) {
        if (data.length === 0) return '没有数据';
        
        const headers = Object.keys(data[0] || {});
        const rows = [headers];
        data.forEach(item => {
          rows.push(headers.map(header => {
            const value = item[header];
            return typeof value === 'object' ? JSON.stringify(value) : String(value || '');
          }));
        });
        return table(rows);
      } else {
        if (!data || Object.keys(data).length === 0) return '没有数据';
        
        const rows = [['属性', '值']];
        Object.entries(data).forEach(([key, value]) => {
          rows.push([key, typeof value === 'object' ? JSON.stringify(value) : String(value || '')]);
        });
        return table(rows);
      }
    default:
      return data;
  }
}

// 应用资源文件
program
  .command('apply')
  .description('从文件应用资源定义')
  .requiredOption('-f, --file <file>', '资源定义文件路径')
  .action(async (options) => {
    await initRuntime();
    
    const { file } = options;
    const namespace = program.getOptionValue('namespace');
    const verbose = program.getOptionValue('verbose');
    
    try {
      console.log(`读取文件: ${file}`);
      // 读取并解析资源文件
      const content = fs.readFileSync(file, 'utf8');
      const resource = yaml.load(content);
      
      if (!resource || !resource.kind || !resource.metadata || !resource.metadata.name) {
        console.error('错误: 无效的资源定义文件');
        process.exit(1);
      }
      
      const { kind, metadata } = resource;
      const { name } = metadata;
      
      // 设置命名空间
      if (!metadata.namespace) {
        metadata.namespace = namespace;
      }
      
      // 资源类型映射
      const typeMap = {
        'Tool': 'tools',
        'Agent': 'agents',
        'Workflow': 'workflows',
        'Network': 'networks'
      };
      
      const resourceType = typeMap[kind];
      if (!resourceType) {
        console.error(`错误: 不支持的资源类型 ${kind}`);
        process.exit(1);
      }
      
      // 应用资源
      await runtime.setResource(resourceType, name, metadata.namespace, resource);
      
      console.log(`成功添加 ${kind} "${name}" 到命名空间 "${metadata.namespace}"`);
    } catch (error) {
      console.error('应用资源失败:', error.message);
      if (verbose) console.error(error.stack);
      process.exit(1);
    }
  });

// 命令: get - 获取资源列表
program
  .command('get <resourceType>')
  .description('获取资源列表')
  .action(async (resourceType, options) => {
    try {
      const opts = { ...program.opts(), ...options };
      const namespace = opts.namespace;
      
      const typesMap = {
        'agent': 'agents',
        'agents': 'agents',
        'workflow': 'workflows',
        'workflows': 'workflows',
        'network': 'networks',
        'networks': 'networks',
        'tool': 'tools',
        'tools': 'tools'
      };
      
      const type = typesMap[resourceType.toLowerCase()];
      
      if (!type) {
        console.error(chalk.red(`错误: 无效的资源类型 "${resourceType}"`));
        process.exit(1);
      }
      
      // 从运行时获取资源
      const resources = await runtime.getResources(type, namespace);
      
      if (!resources || resources.length === 0) {
        console.log(chalk.yellow(`没有找到${resourceType}资源`));
        return;
      }
      
      const resourceList = resources.map(res => ({
        NAME: res.metadata?.name || 'unknown',
        NAMESPACE: res.metadata?.namespace || namespace,
        KIND: res.kind,
        CREATED: res.metadata?.createdAt || '刚刚',
        LABELS: res.metadata?.labels ? Object.entries(res.metadata.labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(',') : ''
      }));
      
      console.log(formatOutput(resourceList, opts.output));
    } catch (error) {
      console.error(chalk.red(`获取资源失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: describe - 获取资源详情
program
  .command('describe <resourceType> <name>')
  .description('获取资源详情')
  .action(async (resourceType, name, options) => {
    try {
      const opts = { ...program.opts(), ...options };
      const namespace = opts.namespace;
      
      const typesMap = {
        'agent': 'agents',
        'workflow': 'workflows',
        'network': 'networks',
        'tool': 'tools'
      };
      
      const type = typesMap[resourceType.toLowerCase()];
      
      if (!type) {
        console.error(chalk.red(`错误: 无效的资源类型 "${resourceType}"`));
        process.exit(1);
      }
      
      // 从运行时获取资源详情
      const resource = await runtime.getResource(type, name, namespace);
      
      if (!resource) {
        console.error(chalk.red(`错误: 未找到 ${resourceType} "${name}" 在命名空间 "${namespace}"`));
        process.exit(1);
      }
      
      let output;
      if (opts.output === 'json' || opts.output === 'yaml') {
        output = formatOutput(resource, opts.output);
      } else {
        // 美化输出
        console.log(chalk.blue(`名称:         ${resource.metadata?.name}`));
        console.log(chalk.blue(`命名空间:     ${resource.metadata?.namespace || namespace}`));
        console.log(chalk.blue(`类型:         ${resource.kind}`));
        console.log(chalk.blue(`API版本:      ${resource.apiVersion || 'mastra.ai/v1'}`));
        
        if (resource.metadata?.labels) {
          console.log(chalk.blue(`标签:`));
          for (const [key, value] of Object.entries(resource.metadata.labels)) {
            console.log(chalk.blue(`  ${key}: ${value}`));
          }
        }
        
        if (resource.metadata?.annotations) {
          console.log(chalk.blue(`注解:`));
          for (const [key, value] of Object.entries(resource.metadata.annotations)) {
            console.log(chalk.blue(`  ${key}: ${value}`));
          }
        }
        
        console.log(chalk.blue(`\n规格:`));
        const formattedSpec = formatOutput(resource.spec || {}, 'json');
        console.log(formattedSpec);
        
        return;
      }
      
      console.log(output);
    } catch (error) {
      console.error(chalk.red(`获取资源详情失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: run - 运行资源
program
  .command('run <resourceType> <name>')
  .description('运行资源')
  .option('-i, --input <input>', '资源输入文本')
  .option('-p, --params <params>', '资源输入参数(JSON格式)')
  .option('-o, --output-file <file>', '输出到文件')
  .action(async (resourceType, name, options) => {
    try {
      const opts = { ...program.opts(), ...options };
      const namespace = opts.namespace;
      
      const typesMap = {
        'agent': 'agents',
        'workflow': 'workflows',
        'network': 'networks'
      };
      
      const type = typesMap[resourceType.toLowerCase()];
      
      if (!type) {
        console.error(chalk.red(`错误: 无效的资源类型 "${resourceType}"`));
        process.exit(1);
      }
      
      // 构建输入参数
      let input, params;
      if (options.input) {
        input = options.input;
      } else if (options.params) {
        try {
          params = JSON.parse(options.params);
        } catch (error) {
          console.error(chalk.red('错误: 无效的JSON参数'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }
      
      console.log(chalk.blue(`开始运行 ${resourceType} "${name}"...`));
      
      // 根据资源类型执行
      let result;
      if (type === 'agents') {
        result = await runtime.executeAgent(name, input, namespace);
      } else if (type === 'workflows') {
        result = await runtime.executeWorkflow(name, params || {}, namespace);
      } else if (type === 'networks') {
        result = await runtime.executeNetwork(name, input, namespace);
      }
      
      if (!result) {
        console.error(chalk.red(`执行 ${resourceType} "${name}" 返回空结果`));
        process.exit(1);
      }
      
      // 输出结果
      if (options.outputFile) {
        fs.writeFileSync(options.outputFile, JSON.stringify(result, null, 2));
        console.log(chalk.green(`输出已保存到 ${options.outputFile}`));
      } else {
        console.log(chalk.green('执行完成!'));
        console.log(formatOutput(result, opts.output));
      }
    } catch (error) {
      console.error(chalk.red(`执行资源失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: delete - 删除资源
program
  .command('delete <resourceType> <name>')
  .description('删除资源')
  .action(async (resourceType, name, options) => {
    try {
      const opts = { ...program.opts(), ...options };
      const namespace = opts.namespace;
      
      const typesMap = {
        'agent': 'agents',
        'workflow': 'workflows',
        'network': 'networks',
        'tool': 'tools'
      };
      
      const type = typesMap[resourceType.toLowerCase()];
      
      if (!type) {
        console.error(chalk.red(`错误: 无效的资源类型 "${resourceType}"`));
        process.exit(1);
      }
      
      // 从运行时删除资源
      await runtime.deleteResource(type, name, namespace);
      console.log(chalk.green(`${resourceType} "${name}" 已从命名空间 "${namespace}" 中删除`));
    } catch (error) {
      console.error(chalk.red(`删除资源失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: tool - 执行工具函数
program
  .command('tool <name> <function>')
  .description('执行工具函数')
  .option('-p, --params <json>', '函数参数 (JSON 格式)', '{}')
  .action(async (name, functionName, options) => {
    await initRuntime();
    
    const { params } = options;
    const namespace = program.getOptionValue('namespace');
    const verbose = program.getOptionValue('verbose');
    
    try {
      // 解析参数
      const parsedParams = JSON.parse(params);
      
      // 执行工具函数
      const result = await runtime.executeTool(name, functionName, parsedParams);
      
      // 输出结果
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('错误:', error.message);
      if (verbose) console.error(error.stack);
      process.exit(1);
    }
  });

// 命令: logs - 查看执行日志
program
  .command('logs <executionId>')
  .description('查看执行日志')
  .action(async (executionId, options) => {
    try {
      const opts = { ...program.opts(), ...options };
      
      // 获取执行记录
      const execution = await runtime.getExecution(executionId);
      
      if (!execution) {
        console.error(chalk.red(`错误: 未找到执行记录 "${executionId}"`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`执行 ID: ${executionId}`));
      console.log(chalk.blue(`类型: ${execution.type}`));
      console.log(chalk.blue(`状态: ${execution.status}`));
      console.log(chalk.blue(`开始时间: ${execution.startTime}`));
      
      if (execution.endTime) {
        console.log(chalk.blue(`结束时间: ${execution.endTime}`));
        const duration = (new Date(execution.endTime) - new Date(execution.startTime)) / 1000;
        console.log(chalk.blue(`持续时间: ${duration.toFixed(2)}秒`));
      }
      
      console.log(chalk.green('\n执行详情:'));
      console.log(formatOutput(execution, opts.output));
    } catch (error) {
      console.error(chalk.red(`获取执行日志失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: history - 查看执行历史
program
  .command('history')
  .description('查看执行历史')
  .option('--limit <number>', '限制记录数量', '10')
  .action(async (options) => {
    try {
      const opts = { ...program.opts(), ...options };
      const limit = parseInt(options.limit);
      
      // 获取执行历史
      const executions = await runtime.getExecutions();
      
      if (!executions || executions.length === 0) {
        console.log(chalk.yellow('没有执行历史记录'));
        return;
      }
      
      // 按时间降序排序并限制数量
      const latestExecutions = executions
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, limit);
      
      // 格式化展示
      const executionList = latestExecutions.map(exec => ({
        ID: exec.id || exec.executionId || '-',
        TYPE: exec.type,
        RESOURCE: exec.resourceName || '-',
        STATUS: exec.status,
        STARTED: new Date(exec.startTime).toLocaleString(),
        DURATION: exec.endTime 
          ? `${((new Date(exec.endTime) - new Date(exec.startTime)) / 1000).toFixed(1)}s`
          : '-'
      }));
      
      console.log(formatOutput(executionList, opts.output));
    } catch (error) {
      console.error(chalk.red(`获取执行历史失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// 命令: config - 配置命令行工具
program
  .command('config')
  .description('配置命令行工具')
  .option('--set-context <context>', '设置当前上下文')
  .option('--list-contexts', '列出所有上下文')
  .action((options) => {
    try {
      if (options.setContext) {
        console.log(chalk.green(`上下文已设置为 "${options.setContext}"`));
      } else if (options.listContexts) {
        console.log(chalk.blue('可用上下文:'));
        console.log('  default (当前)');
        console.log('  development');
        console.log('  production');
      } else {
        console.log(chalk.blue('当前配置:'));
        console.log(`命名空间: ${program.opts().namespace}`);
        console.log(`输出格式: ${program.opts().output}`);
        console.log(`详细模式: ${program.opts().verbose ? '启用' : '禁用'}`);
      }
    } catch (error) {
      console.error(chalk.red(`配置操作失败: ${error.message}`));
      if (program.opts().verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

/**
 * 初始化运行时
 * @returns {Promise<void>}
 */
async function initRuntime() {
  try {
    // 初始化运行时
    await runtime.initialize();
  } catch (error) {
    console.error('运行时初始化失败:', error.message);
    process.exit(1);
  }
}

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

module.exports = program; 