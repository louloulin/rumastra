# 简单 MastraPod 示例

这个示例演示了 MastraPod 的基本功能和验证。MastraPod 是一种基于 Kubernetes 风格的声明式配置，用于定义和管理 Mastra Runtime 资源。

## 目录结构

```
simple-pod/
├── README.md           # 本文档
├── mastrapod.yaml      # MastraPod 配置文件
├── index.js            # 运行示例的入口文件
├── validate.js         # MastraPod 配置验证脚本
├── test.js             # 综合测试脚本
└── tools/              # 工具实现目录
    └── calculator.js   # 计算器工具实现
```

## 功能特性

这个示例展示了以下功能:

1. **全局配置**: 提供商配置、内存配置和日志配置
2. **资源定义**: 
   - 工具资源 (Tool)
   - 代理资源 (Agent)
   - 工作流资源 (Workflow)
   - 自定义资源定义 (CRD)
   - 自定义资源实例
3. **资源引用**: 代理引用工具，工作流引用代理
4. **验证能力**: 验证配置的有效性，包括资源引用和依赖关系

## 运行方法

### 安装依赖

首先确保安装了 kastra 包:

```bash
npm install kastra
```

### 验证配置

运行验证脚本检查 MastraPod 配置是否有效:

```bash
node validate.js
```

### 运行示例

运行示例需要 Node.js 环境和有效的 API 密钥:

```bash
# 设置API密钥
export OPENAI_API_KEY=your_openai_api_key
export ANTHROPIC_API_KEY=your_anthropic_api_key

# 运行示例
node index.js
```

### 运行测试

运行全面测试，包括配置验证、文件检查和示例运行:

```bash
node test.js
```

## MastraPod 结构

示例中的 MastraPod 配置遵循以下结构:

1. **元数据**: 名称、命名空间、标签等
2. **全局配置**: 
   - providers: 提供商配置
   - memory: 内存配置
   - logging: 日志配置
3. **资源列表**: 
   - 工具、代理、工作流等资源定义
   - 自定义资源定义和实例
   
## 扩展方法

您可以通过以下方式扩展此示例:

1. 添加更多工具实现
2. 定义复杂的工作流
3. 创建新的自定义资源类型
4. 添加网络资源 (Network)

## 实现细节

### 配置验证

`validate.js` 文件实现了对 MastraPod 配置的详细验证，包括:

- 资源存在性验证
- 资源引用验证
- 全局配置验证
- 工具实现文件验证
- CRD 和自定义资源验证

### 运行时示例

`index.js` 文件演示了如何:

1. 加载 MastraPod 配置
2. 解析资源
3. 应用全局配置
4. 加载资源
5. 执行工作流和代理
6. 处理自定义资源

## 注意事项

- 示例中使用的计算器工具仅作为演示使用，生产环境中应使用更安全的实现
- 运行示例需要有效的 API 密钥
- 所有导入均直接使用 kastra 包，无需关注源码路径 