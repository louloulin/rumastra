# MastraPod CLI 任务管理示例

这个示例展示了如何使用 MastraPod CLI 管理和执行任务相关资源。示例包含一个任务管理工具、一个任务助手智能体、一个任务处理工作流和一个专家网络，共同构成一个完整的任务管理系统。

## 资源概述

本示例包含以下四个资源文件：

1. **task-manager (Tool)**: 实现任务管理的核心功能，包括创建、更新、查询和删除任务。
2. **task-assistant (Agent)**: 一个智能助手，能够帮助用户管理任务并提供优化建议。
3. **task-processing-workflow (Workflow)**: 一个任务处理工作流，用于自动化创建、分析任务并生成执行计划。
4. **task-management-network (Network)**: 一个任务管理专家网络，由多个专家智能体协作处理复杂任务。

## 使用方法

### 准备工作

首先，确保已安装并配置好 MastraPod CLI：

```bash
# 进入项目目录
cd examples/mastrapod-cli

# 安装依赖
npm install

# 使脚本可执行
chmod +x mastrapod.js
```

### 应用资源

将示例资源应用到 MastraPod 运行时：

```bash
# 应用任务管理工具
./mastrapod.js apply -f example-task-tool.yaml

# 应用任务助手智能体
./mastrapod.js apply -f example-task-agent.yaml

# 应用任务处理工作流
./mastrapod.js apply -f example-task-workflow.yaml

# 应用任务管理网络
./mastrapod.js apply -f example-task-network.yaml
```

### 查看资源

查看已应用的资源：

```bash
# 查看所有工具
./mastrapod.js get tools

# 查看所有智能体
./mastrapod.js get agents

# 查看所有工作流
./mastrapod.js get workflows

# 查看所有网络
./mastrapod.js get networks

# 查看特定资源详情
./mastrapod.js describe tool task-manager
./mastrapod.js describe agent task-assistant
./mastrapod.js describe workflow task-processing-workflow
./mastrapod.js describe network task-management-network
```

## 示例操作

### 直接调用工具函数

```bash
# 创建任务
./mastrapod.js tool task-manager createTask -p '{"title":"完成项目报告","description":"编写第二季度项目进展报告","priority":"high","tags":["报告","项目"]}'

# 查询任务
./mastrapod.js tool task-manager getTasks -p '{}'

# 更新任务状态（使用上一步返回的任务ID）
./mastrapod.js tool task-manager updateTaskStatus -p '{"taskId":"task-1","status":"in-progress"}'

# 根据条件查询任务
./mastrapod.js tool task-manager getTasks -p '{"status":"in-progress","priority":"high"}'

# 删除任务
./mastrapod.js tool task-manager deleteTask -p '{"taskId":"task-1"}'
```

### 与任务助手交互

```bash
# 启动与任务助手的对话
./mastrapod.js run agent task-assistant -i "我需要创建一个新任务：明天之前完成项目提案，这是一个高优先级任务。"

# 查询特定类型的任务
./mastrapod.js run agent task-assistant -i "显示所有高优先级任务"

# 获取任务管理建议
./mastrapod.js run agent task-assistant -i "如何更好地组织我的任务？"
```

### 运行任务处理工作流

```bash
# 运行任务处理工作流
./mastrapod.js run workflow task-processing-workflow -p '{
  "title": "制定市场推广策略",
  "description": "为新产品制定全面的市场推广策略，包括社交媒体、线下活动和内容营销",
  "dueDate": "2024-07-15T00:00:00Z",
  "priority": "high",
  "tags": ["营销", "策略", "新产品"]
}'

# 保存工作流输出到文件
./mastrapod.js run workflow task-processing-workflow -p '{
  "title": "组织团队建设活动",
  "description": "计划和组织一次团队建设活动，提高团队凝聚力和协作能力",
  "dueDate": "2024-06-20T00:00:00Z",
  "priority": "medium",
  "tags": ["团队建设", "活动"]
}' -o task-result.json
```

### 运行任务管理网络

```bash
# 使用任务管理专家网络处理复杂任务
./mastrapod.js run network task-management-network -i "我需要为我们公司的产品发布会规划一系列任务，包括营销材料准备、场地安排、嘉宾邀请和技术演示准备。请提供详细的任务规划、优先级排序和资源分配建议。"

# 咨询专家网络关于任务跟踪系统
./mastrapod.js run network task-management-network -i "我们团队正在进行一个为期6个月的软件开发项目，请推荐一个有效的任务跟踪和进度报告方法，确保项目按时完成。"
```

## 定制扩展

可以通过以下方式定制和扩展这个任务管理系统：

1. **添加新功能**：编辑 `example-task-tool.yaml` 文件添加新的工具函数，如任务提醒、任务依赖跟踪等。
   
2. **改进智能体**：编辑 `example-task-agent.yaml` 文件，修改系统提示或添加更多工具集成，提供更专业的任务管理建议。

3. **优化工作流**：编辑 `example-task-workflow.yaml` 文件，添加新的步骤或修改现有步骤，以实现更复杂的任务处理流程。

4. **扩展专家网络**：编辑 `example-task-network.yaml` 文件，添加更多专业领域的专家智能体，如风险评估专家、质量控制专家等，以提供更全面的任务管理解决方案。

## 模拟数据说明

本示例使用内存中的模拟数据存储，这意味着：

1. 数据只在运行时存在，重启应用后会丢失
2. 多次运行CLI将创建新的运行时实例，不会共享数据
3. 适用于演示和测试，但不适合生产环境

在实际应用中，可以将工具实现连接到持久化存储，如数据库或文件系统。

## 集成到其他系统

这个任务管理系统可以集成到其他应用和工作流程中：

1. **与日历系统集成**：扩展工具实现，连接到日历API创建任务截止日期提醒
2. **与项目管理工具集成**：将任务同步到Jira、Asana等项目管理工具
3. **与通知系统集成**：添加任务状态变化的通知功能
4. **与文档系统集成**：关联任务与相关文档和资源

## 进阶用法

### 利用专家网络处理复杂任务

任务管理专家网络由四个专业智能体组成，每个智能体专注于任务管理的不同方面：

1. **规划专家**：分解复杂任务并创建详细计划
2. **优先级专家**：评估任务的重要性和紧急性
3. **资源专家**：确定完成任务所需的人员、时间和工具
4. **跟踪专家**：创建任务监控和进度报告系统

这种协作方式适合处理以下场景：

```bash
# 处理复杂项目的全面规划
./mastrapod.js run network task-management-network -i "我需要规划一次公司年度大会，包括场地安排、嘉宾邀请、议程设计和后勤保障，请提供全面的任务管理方案。"

# 解决资源冲突问题
./mastrapod.js run network task-management-network -i "我们团队同时在处理三个高优先级项目，但资源有限，请帮助我们制定一个有效的任务分配和优先级策略。"

# 建立项目管理体系
./mastrapod.js run network task-management-network -i "我们正在组建一个新团队，需要建立一套完整的任务管理和项目跟踪系统，请提供建议。"
```

### 批量任务处理

创建脚本批量处理任务：

```bash
#!/bin/bash
# 批量创建任务示例

# 从CSV文件读取任务
while IFS=, read -r title description dueDate priority tags
do
    # 处理标签（从逗号分隔的字符串转换为JSON数组）
    tagArray=$(echo $tags | sed 's/;/","/g' | sed 's/^/["/' | sed 's/$/"]/')
    
    # 调用CLI创建任务
    ./mastrapod.js tool task-manager createTask -p "{\"title\":\"$title\",\"description\":\"$description\",\"dueDate\":\"$dueDate\",\"priority\":\"$priority\",\"tags\":$tagArray}"
done < tasks.csv
```

## 故障排除

### 常见问题

1. **资源未找到**：确保已正确应用所有资源，并检查命名空间设置
2. **函数执行失败**：检查参数格式是否正确，特别是JSON格式和必填字段
3. **工作流执行中断**：检查工作流步骤依赖关系和各步骤输出格式

### 日志查看

查看执行历史和日志：

```bash
# 查看最近的执行历史
./mastrapod.js history --limit 5

# 查看特定执行日志
./mastrapod.js logs <execution-id>
```

## 结语

MastraPod CLI 提供了一种强大而灵活的方式来管理和执行人工智能资源。通过这个任务管理示例，可以看到如何结合工具、智能体和工作流创建功能完整的应用。这只是 MastraPod 功能的一小部分展示，可以基于相同的模式构建更复杂、更强大的智能应用。 