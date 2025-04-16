#!/bin/bash

# MastraPod CLI 任务管理示例脚本
# 此脚本演示了如何使用MastraPod CLI来管理任务，包括创建、查询、更新和执行任务工作流

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 函数：打印带颜色的标题
print_title() {
  echo -e "\n${BLUE}===== $1 =====${NC}\n"
}

# 函数：打印带颜色的信息
print_info() {
  echo -e "${GREEN}$1${NC}"
}

# 函数：打印带颜色的警告
print_warning() {
  echo -e "${YELLOW}$1${NC}"
}

# 函数：打印带颜色的错误
print_error() {
  echo -e "${RED}$1${NC}"
}

# 函数：运行命令并显示结果
run_cmd() {
  echo -e "${YELLOW}执行命令:${NC} $1"
  echo
  eval $1
  echo
}

# 确保脚本在正确的目录执行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd $SCRIPT_DIR

# 检查mastrapod.js是否可执行
if [ ! -x "./mastrapod.js" ]; then
  print_warning "正在使mastrapod.js可执行..."
  chmod +x ./mastrapod.js
fi

# 0. 检查示例资源文件是否存在
print_title "检查示例资源文件"
MISSING_FILES=0

if [ ! -f "./example-task-tool.yaml" ]; then
  print_error "缺少example-task-tool.yaml文件!"
  MISSING_FILES=1
fi

if [ ! -f "./example-task-agent.yaml" ]; then
  print_error "缺少example-task-agent.yaml文件!"
  MISSING_FILES=1
fi

if [ ! -f "./example-task-workflow.yaml" ]; then
  print_error "缺少example-task-workflow.yaml文件!"
  MISSING_FILES=1
fi

if [ ! -f "./example-task-network.yaml" ]; then
  print_error "缺少example-task-network.yaml文件!"
  MISSING_FILES=1
fi

if [ $MISSING_FILES -eq 1 ]; then
  print_error "缺少必要的资源文件，请先创建这些文件再运行此脚本。"
  exit 1
else
  print_info "所有示例资源文件已找到。"
fi

# 1. 应用资源
print_title "应用资源"
run_cmd "./mastrapod.js apply -f example-task-tool.yaml"
run_cmd "./mastrapod.js apply -f example-task-agent.yaml"
run_cmd "./mastrapod.js apply -f example-task-workflow.yaml"
run_cmd "./mastrapod.js apply -f example-task-network.yaml"

# 2. 查看已应用的资源
print_title "查看资源"
run_cmd "./mastrapod.js get tools"
run_cmd "./mastrapod.js get agents"
run_cmd "./mastrapod.js get workflows"
run_cmd "./mastrapod.js get networks"

# 3. 调用工具API创建任务
print_title "创建示例任务"
run_cmd "./mastrapod.js tool task-manager createTask -p '{\"title\":\"撰写项目总结报告\",\"description\":\"为第二季度项目编写总结报告，包括进度、成就和挑战\",\"priority\":\"high\",\"tags\":[\"报告\",\"项目\"]}'"

# 4. 查询所有任务
print_title "查询所有任务"
run_cmd "./mastrapod.js tool task-manager getTasks -p '{}'"

# 5. 更新任务状态
print_title "更新任务状态"
print_info "我们假设任务ID为 task-1"
run_cmd "./mastrapod.js tool task-manager updateTaskStatus -p '{\"taskId\":\"task-1\",\"status\":\"in-progress\"}'"

# 6. 查询高优先级任务
print_title "查询高优先级任务"
run_cmd "./mastrapod.js tool task-manager getTasks -p '{\"priority\":\"high\"}'"

# 7. 使用任务助手
print_title "与任务助手交互"
run_cmd "./mastrapod.js run agent task-assistant -i \"我需要了解如何优化我的高优先级任务管理\""

# 8. 运行任务处理工作流
print_title "运行任务处理工作流"
run_cmd "./mastrapod.js run workflow task-processing-workflow -p '{
  \"title\": \"组织团队建设活动\",
  \"description\": \"计划一次团队建设活动，提高团队凝聚力和协作能力\",
  \"dueDate\": \"2024-06-20T00:00:00Z\",
  \"priority\": \"medium\",
  \"tags\": [\"团队建设\", \"活动\"]
}'"

# 9. 使用任务管理专家网络
print_title "使用任务管理专家网络"
run_cmd "./mastrapod.js run network task-management-network -i \"我们团队正在准备一个为期三个月的新产品开发项目，需要规划任务、确定优先级、分配资源并建立进度跟踪机制。请提供专业建议。\""

# 10. 查看执行历史
print_title "查看执行历史"
run_cmd "./mastrapod.js history --limit 5"

print_title "示例完成"
print_info "任务管理示例演示已完成！您可以继续使用CLI工具进行更多探索。"
print_info "查看TASK_MANAGEMENT_EXAMPLE.md文件获取更多详细信息和示例。" 