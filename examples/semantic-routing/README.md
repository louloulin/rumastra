# 语义匹配路由策略示例

这个示例演示了如何使用 NetworkExecutor 的语义匹配路由策略，根据用户输入内容自动选择最适合的专业智能体来处理请求。

## 功能概述

语义匹配路由是一种智能路由机制，它可以：

- 分析用户输入的内容
- 将其与智能体的专长领域进行匹配
- 选择最合适的智能体来响应请求
- 随着系统使用，基于历史表现不断优化选择

## 运行示例

```bash
# 从项目根目录运行
pnpm ts-node packages/runtimes/examples/semantic-routing/index.ts
```

## 核心概念

### 1. 智能体特性描述

为了使语义匹配有效工作，每个智能体需要在网络定义中提供以下描述信息：

```yaml
agents:
  - name: technical-agent
    ref: default.technical-agent
    role: 技术支持
    description: 解决技术问题和故障排除
    specialties: 硬件问题 软件故障 系统错误 网络连接
```

关键字段：
- `role`: 角色标识
- `description`: 详细描述
- `specialties`: 专长领域（语义匹配的主要依据）

### 2. 使用语义匹配策略

在执行网络时，只需指定使用语义匹配路由策略：

```typescript
const result = await networkExecutor.generate(userInput, {
  routingStrategy: RoutingStrategy.SEMANTIC_MATCHING,
  enableTracing: true // 可选，启用执行追踪
});
```

### 3. 对比不同路由策略

示例还展示了不同路由策略的对比：
- 默认策略：使用第一个可用的智能体
- 轮询策略：依次使用每个智能体
- 基于历史策略：根据历史表现选择
- 语义匹配策略：根据语义相关性选择

## 最佳实践

1. 为每个智能体提供详细的`specialties`字段，包含关键词
2. 使用空格分隔关键词，使分词更准确
3. 关键词应当具有辨识度，避免过于宽泛的描述
4. 定期更新智能体描述以保持其准确性

## 进阶功能

当前实现使用简单的关键词匹配算法，未来会支持：
- 向量嵌入相似度匹配
- 跨语言语义理解
- 上下文感知的智能体选择
- 基于用户反馈的自适应学习

## 相关文档

- [NetworkExecutor 文档](../../docs/NetworkExecutor.md)
- [路由策略类型定义](../../src/core/network/types.ts) 