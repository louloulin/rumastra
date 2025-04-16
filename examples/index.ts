import { loadFromFile } from '../src';
import path from 'path';

async function main() {
  try {
    // 加载配置文件
    const mastra = await loadFromFile(path.join(__dirname, 'chef-agent.yaml'));

    // 获取厨师智能体
    const chef = mastra.getAgent('chef');

    // 使用智能体生成回复
    const response = await chef.generate({
      messages: [
        {
          role: 'user',
          content: 'I have eggs, cheese, and bread. What can I make?',
        },
      ],
    });

    console.log('Chef says:', response.message.content);

    // 使用工作流
    const workflow = mastra.getWorkflow('recipe-suggestion');
    const result = await workflow.start({
      input: {
        ingredients: ['eggs', 'cheese', 'bread'],
      },
    });

    console.log('Workflow result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
