# Comprehensive MastraPod 示例

这个示例展示了 Mastra Runtime 的全部功能，通过一个完整的 MastraPod 配置来演示声明式 API 定义 AI 应用的能力。

## 功能特点

本示例覆盖以下核心功能：

1. **声明式 API 定义**：使用 Kubernetes 风格的资源定义
2. **自定义资源定义 (CRD)**：定义和使用自定义资源类型
3. **LLM 资源**：定义和管理不同提供商的 LLM 模型
4. **工具集成**：定义和使用工具资源
5. **代理定义**：配置智能代理
6. **工作流定义**：创建和管理工作流
7. **网络定义**：构建协作智能体网络
8. **资源包含**：通过目录或文件包含外部资源
9. **环境变量替换**：支持在配置中使用环境变量
10. **条件资源**：基于条件加载资源

## 目录结构

```
comprehensive-pod/
├── mastrapod.yaml           # 主配置文件
├── tools/                   # 工具实现
│   ├── weather.js           # 天气查询工具
│   └── database.js          # 数据库查询工具
├── additional-resources/    # 额外资源目录
├── specialized/             # 特殊资源目录
└── validate.js              # 验证脚本
```

## MastraPod 资源说明

mastrapod.yaml 文件包含以下主要部分：

### 1. 全局配置

- **提供商配置**：OpenAI 和 Anthropic 的 API 密钥和默认模型
- **内存配置**：向量存储配置
- **日志配置**：日志级别和格式

### 2. 自定义资源定义 (CRD)

定义了一个 `DataSource` 自定义资源类型，用于表示数据库连接。

### 3. LLM 资源

定义了不同用途的 LLM 模型：
- `general-purpose-llm`：通用对话模型
- `reasoning-llm`：推理专用模型

### 4. 工具资源

定义了几个功能工具：
- `weather-tool`：天气查询工具
- `database-query-tool`：数据库查询工具

### 5. 代理资源

定义了三种智能代理：
- `assistant-agent`：通用助手
- `data-analyst-agent`：数据分析师
- `summarizer-agent`：内容总结专家

### 6. 工作流资源

定义了数据分析工作流，包含多个步骤：
1. 查询数据
2. 分析数据
3. 总结结果

### 7. 网络资源

定义了由多个专业代理组成的协作网络。

## 运行验证

执行以下命令来验证 MastraPod 配置：

```bash
# 先构建 runtimes 包
cd ../../
npm run build

# 返回示例目录并运行验证
cd examples/comprehensive-pod
node validate.js
```

验证脚本将检查配置的有效性，包括：

- 解析 YAML 配置
- 验证资源定义
- 检查 CRD 和自定义资源
- 验证 LLM 配置
- 检查工具实现
- 验证资源包含

## 环境变量

示例使用以下环境变量，可以根据需要设置：

- `OPENAI_API_KEY`：OpenAI API 密钥
- `ANTHROPIC_API_KEY`：Anthropic API 密钥
- `MEMORY_URL`：内存存储 URL
- `DB_USERNAME`：数据库用户名
- `DB_PASSWORD`：数据库密码
- `ENABLE_CUSTOM_TOOLS`：是否启用自定义工具

## 扩展示例

可以通过以下方式扩展这个示例：

1. 添加新的工具实现
2. 创建新的 CRD 类型
3. 定义新的代理和工作流
4. 添加新的 LLM 提供商配置

## 问题排查

如果遇到运行验证脚本的问题：

1. 确保已经构建了 runtimes 包 (`npm run build` 在包根目录)
2. 检查是否创建了所有必要的目录和文件
3. 确保环境变量设置正确 