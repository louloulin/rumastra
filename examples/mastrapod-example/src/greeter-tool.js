/**
 * 打招呼工具函数
 * @param {Object} params - 参数对象
 * @param {string} [params.name='World'] - 打招呼的对象名称
 * @returns {Object} 包含问候信息的对象
 */
export default function greet(params) {
  const name = params.name || 'World';
  return { greeting: `Hello, ${name}!` };
} 