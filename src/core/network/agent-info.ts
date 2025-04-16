/**
 * 网络代理信息接口
 * 扩展基本的代理定义，增加了语义匹配所需的特性
 */
export interface AgentInfo {
  // 基本属性（来自NetworkConfig中的agents定义）
  name: string;
  ref: string;
  
  // 语义匹配所需额外属性
  role?: string;        // 代理角色
  description?: string; // 代理描述
  specialties?: string; // 代理专长领域，优先用于语义匹配
}

/**
 * 从基本代理定义转换为增强的代理信息
 * @param agent 基本代理定义
 * @param defaults 默认值
 * @returns 增强的代理信息对象
 */
export function enhanceAgentInfo(
  agent: { name: string; ref: string; [key: string]: any },
  defaults: Partial<AgentInfo> = {}
): AgentInfo {
  return {
    name: agent.name,
    ref: agent.ref,
    role: agent.role || defaults.role,
    description: agent.description || defaults.description,
    specialties: agent.specialties || defaults.specialties
  };
} 