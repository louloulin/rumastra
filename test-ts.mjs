// test-ts.mjs - 验证ES Module工具执行
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { loadFromFile } from './dist/index.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试ES Module工具执行
async function testESModuleTool() {
  console.log('=== 测试 ES Module 工具执行 ===');
  try {
    // 从文件加载配置
    const configFilePath = resolve(__dirname, './examples/chef-agent.yaml');
    console.log(`加载配置文件: ${configFilePath}`);
    const builder = await loadFromFile(configFilePath);
    
    // 获取所有可用工具
    const tools = builder.getTools();
    console.log('所有可用工具:', Object.keys(tools));
    
    // 验证ES Module工具是否成功加载
    if (tools['cooking-esm']) {
      console.log('\n1. ES Module工具已成功加载');
      
      // 测试CJS和ESM版本的对比
      console.log('\n2. 比较CommonJS和ES Module版本工具');
      
      // 准备测试数据 - 多组食材组合
      const testIngredients = [
        ['面包', '奶酪', '黄油'],
        ['鸡蛋', '油', '盐', '葱'],
        ['面包', '奶酪', '番茄酱'],
        ['鸡蛋', '奶酪', '牛奶']
      ];
      
      // 逐一测试每组食材
      for (let i = 0; i < testIngredients.length; i++) {
        const ingredients = testIngredients[i];
        console.log(`\n测试食材组合${i+1}: ${ingredients.join(', ')}`);
        
        console.log('CommonJS版本结果:');
        const cjsResult = await tools.cooking.execute({ ingredients });
        console.log(cjsResult.recipes);
        
        console.log('ES Module版本结果:');
        const esmResult = await tools['cooking-esm'].execute({ ingredients });
        console.log(esmResult.recipes);
      }
      
      // 测试智能体和工作流
      console.log('\n3. 验证使用ES Module工具的智能体');
      const agents = builder.getAgents();
      if (agents['chef-esm']) {
        console.log('ES Module智能体已成功加载');
      } else {
        console.log('❌ 未找到ES Module智能体');
      }
      
      console.log('\n4. 验证使用ES Module工具的工作流');
      const workflows = builder.getWorkflows();
      if (workflows['suggestRecipeESM']) {
        console.log('ES Module工作流已成功加载');
      } else {
        console.log('❌ 未找到ES Module工作流');
      }
      
    } else {
      console.log('❌ 错误: ES Module工具未成功加载');
    }
    
    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 执行测试
testESModuleTool().catch(console.error); 