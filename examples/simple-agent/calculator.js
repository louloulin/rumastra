/**
 * 简单的计算器工具，用于执行基本数学运算
 * 
 * @param {Object} args 运算参数
 * @param {string} args.operation 操作类型: 'add', 'subtract', 'multiply', 'divide'
 * @param {number} args.a 第一个数字
 * @param {number} args.b 第二个数字
 * @returns {Object} 运算结果
 */
export default async function calculator(args) {
  const { operation, a, b } = args;
  
  // 验证参数
  if (!operation) {
    throw new Error('缺少 operation 参数');
  }
  
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('a 和 b 必须是数字');
  }
  
  let result;
  
  // 执行相应的运算
  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        throw new Error('除数不能为零');
      }
      result = a / b;
      break;
    default:
      throw new Error(`不支持的运算: ${operation}`);
  }
  
  // 返回结果
  return {
    operation,
    a,
    b,
    result
  };
} 