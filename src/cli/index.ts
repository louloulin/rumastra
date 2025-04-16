#!/usr/bin/env node

import { Command } from 'commander';
import { CLIRuntimeManager } from '../core/cli-runtime-manager';
import fs from 'fs-extra';
import path from 'path';
import { table } from 'table';
import chalk from 'chalk';
import ora from 'ora';
import { 
  RuntimeResource, 
  WorkflowResource, 
  NetworkResource
} from '../types';

// 定义资源状态类型
interface ResourceStatus {
  phase: string;
  conditions?: Array<{
    type: string;
    status: 'True' | 'False' | 'Unknown';
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
  }>;
  lastExecutionTime?: string;
  [key: string]: any;
}

// 版本号从package.json中读取
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf-8')
);

const program = new Command();
const runtimeManager = new CLIRuntimeManager();

// 设置CLI基本信息
program
  .name('mastra')
  .description('Mastra Runtimes CLI - 智能体运行时管理工具')
  .version(packageJson.version);

// 添加全局选项
program
  .option('-c, --config <path>', '全局配置文件路径')
  .option('-v, --verbose', '显示详细输出');

// 资源管理命令
program
  .command('apply')
  .description('应用资源定义')
  .argument('<file>', '资源文件路径或目录')
  .option('-r, --recursive', '递归处理目录')
  .action(async (file, options) => {
    try {
      await runtimeManager.initialize();
      
      const spinner = ora('加载资源中...').start();
      
      // 处理全局配置
      await handleGlobalConfig(program.opts());
      
      const stat = await fs.stat(file);
      let resources: RuntimeResource[] = [];
      
      if (stat.isDirectory()) {
        if (options.recursive) {
          // 递归扫描目录
          spinner.text = `递归扫描目录 ${file} 中...`;
          resources = await scanDirectoryRecursively(file);
        } else {
          // 扫描单个目录
          spinner.text = `扫描目录 ${file} 中...`;
          resources = await runtimeManager.scanDirectory(file);
        }
      } else {
        // 处理单个文件
        spinner.text = `解析文件 ${file} 中...`;
        
        // 检查是否为MastraPod
        const fileContent = await fs.readFile(file, 'utf-8');
        if (fileContent.includes('kind: MastraPod')) {
          const { podConfig, resources: podResources } = await runtimeManager.parseMastraPod(file);
          await runtimeManager.applyGlobalConfig(podConfig);
          resources = podResources;
        } else {
          // 普通资源文件
          const resource = await runtimeManager.parseFile(file);
          resources = [resource];
        }
      }
      
      // 加载所有资源
      spinner.text = `应用 ${resources.length} 个资源中...`;
      
      for (const resource of resources) {
        await runtimeManager.loadResource(resource);
      }
      
      spinner.succeed(`成功应用 ${resources.length} 个资源`);
      
      // 显示资源表格
      const tableData = [
        ['Kind', 'Name', 'Namespace', 'Status']
      ];
      
      for (const resource of resources) {
        const status = (resource.status as ResourceStatus)?.phase || 'Pending';
        tableData.push([
          resource.kind,
          resource.metadata.name,
          resource.metadata.namespace || 'default',
          status
        ]);
      }
      
      console.log(table(tableData));
    } catch (error) {
      ora().fail(`应用资源失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 执行命令
program
  .command('run')
  .description('执行资源')
  .argument('<kind>', '资源类型 (agent|workflow|network)')
  .argument('<name>', '资源名称')
  .option('-i, --input <text>', '输入文本')
  .option('-f, --file <path>', '输入文件路径')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (kind, name, options) => {
    try {
      await runtimeManager.initialize();
      
      // 处理全局配置
      await handleGlobalConfig(program.opts());
      
      let input = options.input || '';
      
      // 从文件读取输入
      if (options.file) {
        input = await fs.readFile(options.file, 'utf-8');
      }
      
      const spinner = ora(`执行 ${kind}/${name} 中...`).start();
      
      let result: any;
      
      switch (kind.toLowerCase()) {
        case 'agent':
          result = await runtimeManager.executeAgent(name, input);
          break;
        case 'workflow':
          // 查询已加载的工作流资源
          // 注意：这里假设资源已通过 apply 命令加载，或通过其他方式添加到运行时
          const workflowResource: WorkflowResource = {
            kind: 'Workflow',
            apiVersion: 'mastra.ai/v1',
            metadata: { name },
            spec: {
              steps: [],  // 这是一个必要字段，但实际的步骤将从已加载的资源中获取
              name: name, // 添加必要的名称字段
              initialStep: ''  // 添加必要的初始步骤字段
            }
          };
          await runtimeManager.executeWorkflow(workflowResource);
          break;
        case 'network':
          // 查询已加载的网络资源
          // 注意：这里假设资源已通过 apply 命令加载，或通过其他方式添加到运行时
          const networkResource: NetworkResource = {
            kind: 'Network',
            apiVersion: 'mastra.ai/v1',
            metadata: { name },
            spec: {
              agents: [],  // 这是一个必要字段，但实际的代理将从已加载的资源中获取
              router: {
                maxSteps: 10,  // 默认最大步骤数
                model: {
                  provider: 'openai',
                  name: 'gpt-4'
                }
              }
            }
          };
          await runtimeManager.executeNetwork(networkResource);
          break;
        default:
          spinner.fail(`不支持的资源类型: ${kind}`);
          process.exit(1);
      }
      
      spinner.succeed(`${kind}/${name} 执行完成`);
      
      // 输出结果
      if (kind.toLowerCase() === 'agent') {
        if (options.output) {
          await fs.writeFile(options.output, result);
          console.log(`结果已保存到: ${options.output}`);
        } else {
          console.log(chalk.green('\n输出:'));
          console.log(result);
        }
      }
    } catch (error) {
      ora().fail(`执行失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 查询命令
program
  .command('get')
  .description('查询资源')
  .argument('<kind>', '资源类型 (agent|workflow|network|tool)')
  .argument('[name]', '资源名称 (可选)')
  .option('-n, --namespace <namespace>', '命名空间')
  .action(async (kind, name, options) => {
    try {
      await runtimeManager.initialize();
      
      // 处理全局配置
      await handleGlobalConfig(program.opts());
      
      const spinner = ora(`查询资源中...`).start();
      
      // 查询资源逻辑将在CLIRuntimeManager中实现
      spinner.succeed('查询完成');
      
      // 显示资源表格
      const tableData = [
        ['Kind', 'Name', 'Namespace', 'Status', 'Age']
      ];
      
      // 这里添加查询结果
      
      console.log(table(tableData));
    } catch (error) {
      ora().fail(`查询失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 处理全局配置
async function handleGlobalConfig(opts: any): Promise<void> {
  if (opts.config) {
    const configPath = path.resolve(opts.config);
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJSON(configPath);
      await runtimeManager.applyGlobalConfig(config);
    } else {
      console.warn(`配置文件不存在: ${configPath}`);
    }
  }
}

// 递归扫描目录
async function scanDirectoryRecursively(dir: string): Promise<RuntimeResource[]> {
  const resources: RuntimeResource[] = [];
  
  // 获取当前目录中的资源
  const currentResources = await runtimeManager.scanDirectory(dir);
  resources.push(...currentResources);
  
  // 获取子目录
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(dir, entry.name);
      const subResources = await scanDirectoryRecursively(subDir);
      resources.push(...subResources);
    }
  }
  
  return resources;
}

// 运行CLI
program.parse(process.argv); 