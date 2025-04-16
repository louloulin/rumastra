import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { loadFromFile, loadFromString } from './dist/index.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试加载配置并验证工具
async function testRuntimeBuilder() {
  console.log('测试1: 从文件加载配置');
  try {
    // 从文件加载配置
    const configFilePath = resolve(__dirname, './examples/chef-agent.yaml');
    const builder = await loadFromFile(configFilePath);
    
    // 验证工具是否成功加载
    const tools = builder.getTools();
    console.log('获取到的工具列表:', Object.keys(tools));
    
    // 测试工具执行 - 测试多种食材组合
    if (tools.cooking) {
      console.log('\n测试多种食材组合:');
      
      // 测试组合1: 应该匹配奶酪三明治
      console.log('\n组合1 - 面包+奶酪+黄油:');
      const result1 = await tools.cooking.execute({ 
        ingredients: ['面包', '奶酪', '黄油'] 
      });
      console.log('匹配食谱:', result1.recipes);
      
      // 测试组合2: 应该匹配炒鸡蛋
      console.log('\n组合2 - 鸡蛋+油+盐+葱:');
      const result2 = await tools.cooking.execute({ 
        ingredients: ['鸡蛋', '油', '盐', '葱'] 
      });
      console.log('匹配食谱:', result2.recipes);
      
      // 测试组合3: 应该匹配简易披萨和奶酪三明治(面包和奶酪共同)
      console.log('\n组合3 - 面包+奶酪+番茄酱:');
      const result3 = await tools.cooking.execute({ 
        ingredients: ['面包', '奶酪', '番茄酱'] 
      });
      console.log('匹配食谱:', result3.recipes);
      
      // 测试组合4: 应该匹配奶酪蛋卷和炒鸡蛋(鸡蛋共同)
      console.log('\n组合4 - 鸡蛋+奶酪+牛奶:');
      const result4 = await tools.cooking.execute({ 
        ingredients: ['鸡蛋', '奶酪', '牛奶'] 
      });
      console.log('匹配食谱:', result4.recipes);
    } else {
      console.log('错误: 烹饪工具未找到');
    }
    
    // 测试从字符串加载配置
    console.log('\n测试2: 从字符串加载配置');
    const yamlString = `
version: "1.0.0"
tools:
  echo:
    id: echo
    description: 简单回显工具
    execute: ${resolve(__dirname, './examples/mock-cooking.cjs')}
agents:
  echo-agent:
    name: Echo Agent
    instructions: 只是回显用户的输入
    model:
      provider: openai
      name: gpt-3.5-turbo
    tools:
      echo: echo
`;
    
    const builderFromString = await loadFromString(yamlString);
    const toolsFromString = builderFromString.getTools();
    console.log('从字符串加载的工具:', Object.keys(toolsFromString));
    
    // 测试字符串中的工具执行
    if (toolsFromString.echo) {
      console.log('测试回显工具执行:');
      const echoResult = await toolsFromString.echo.execute({ 
        ingredients: ['米饭', '香肠', '鸡蛋', '蔬菜'] // 应该匹配香肠炒饭
      });
      console.log('回显工具执行结果:', echoResult);
    } else {
      console.log('错误: 回显工具未找到');
    }
    
    console.log('\n所有测试完成');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 执行测试
testRuntimeBuilder().catch(console.error); 