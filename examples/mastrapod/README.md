# MastraPod 示例

这是一个使用Mastra Runtimes的MastraPod示例，展示如何定义和运行智能体、工具和工作流。

## 功能特性

- 使用YAML定义MastraPod配置
- 支持多种LLM提供商（OpenAI、Anthropic、Qwen）
- 智能体之间的工作流协作
- 工具集成（天气工具示例）

## 开始使用

### 安装依赖

确保你在项目根目录已经安装了所有依赖：

```bash
pnpm install
```

### 基本运行

你可以直接运行示例（将使用模拟响应）：

```bash
node index.js
```

### 使用Qwen（阿里通义千问）

要使用通义千问，你需要：

1. 获取通义千问API密钥（可在[阿里云灵积平台](https://dashscope.aliyun.com/)申请）
2. 使用API密钥运行专用脚本：

```bash
QWEN_API_KEY=your-api-key-here node run-with-qwen.js
```

你也可以指定自定义API基础URL（可选）：

```bash
QWEN_API_KEY=your-api-key-here QWEN_API_BASE_URL=your-custom-url node run-with-qwen.js
```

## 项目结构

- `mastrapod.yaml` - MastraPod配置定义
- `index.js` - 主程序入口
- `run-with-qwen.js` - 通义千问专用入口

## 自定义

你可以修改`mastrapod.yaml`文件来添加更多智能体、工具或工作流。

## API文档

通义千问API文档：https://help.aliyun.com/zh/dashscope/developer-reference/api-details

## 注意事项

- 这是一个演示项目，不适合生产环境使用
- 请确保保护你的API密钥安全 