/**
 * 简单的计算器工具
 * 可以执行基本的数学计算
 */
export default async function calculator(params) {
  try {
    // 获取表达式
    const { expression } = params;
    
    if (!expression) {
      throw new Error('缺少必需的表达式参数');
    }
    
    // 创建一个安全的计算环境
    // 注意：在实际生产环境中，应使用更安全的方法来计算表达式
    // 这里使用eval仅作为演示
    const sanitizedExpression = sanitizeExpression(expression);
    
    // 计算结果
    // eslint-disable-next-line no-eval
    const result = eval(sanitizedExpression);
    
    return {
      result,
      expression: sanitizedExpression
    };
  } catch (error) {
    throw new Error(`计算错误: ${error.message}`);
  }
}

/**
 * 净化表达式，只允许安全的数学运算
 * @param {string} expression 原始表达式
 * @returns {string} 净化后的表达式
 */
function sanitizeExpression(expression) {
  // 移除所有不安全字符，只保留数字、数学运算符和空格
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
  
  // 检查是否有不允许的字符被移除
  if (sanitized !== expression) {
    console.warn('表达式中包含不安全字符，已被移除');
  }
  
  return sanitized;
} 