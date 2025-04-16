/**
 * 模拟数据库查询工具 - 根据SQL查询返回数据
 */
module.exports = async function queryDatabase(input) {
  // 解构参数
  const { query, datasource = 'main-database' } = input;
  
  if (!query) {
    throw new Error('查询语句是必须的');
  }

  console.log(`在数据源 ${datasource} 上执行查询: ${query}`);
  
  // 模拟API请求延迟
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 简单解析SQL确定要返回什么样的模拟数据
  const queryLower = query.toLowerCase();
  
  // 模拟用户表数据
  if (queryLower.includes('user') || queryLower.includes('用户')) {
    return [
      { id: 1, name: '张三', age: 28, department: '技术部', role: '开发工程师' },
      { id: 2, name: '李四', age: 35, department: '产品部', role: '产品经理' },
      { id: 3, name: '王五', age: 42, department: '市场部', role: '市场总监' },
      { id: 4, name: '赵六', age: 25, department: '技术部', role: '测试工程师' },
      { id: 5, name: '钱七', age: 31, department: '设计部', role: 'UI设计师' }
    ];
  }
  
  // 模拟产品表数据
  if (queryLower.includes('product') || queryLower.includes('产品')) {
    return [
      { id: 101, name: '智能手机A', price: 4999, stock: 120, category: '电子产品' },
      { id: 102, name: '平板电脑B', price: 3499, stock: 80, category: '电子产品' },
      { id: 103, name: '笔记本电脑C', price: 7999, stock: 50, category: '电子产品' },
      { id: 104, name: '智能手表D', price: 1999, stock: 200, category: '可穿戴设备' },
      { id: 105, name: '蓝牙耳机E', price: 899, stock: 300, category: '音频设备' }
    ];
  }
  
  // 模拟订单表数据
  if (queryLower.includes('order') || queryLower.includes('订单')) {
    return [
      { id: 1001, userId: 1, productId: 101, quantity: 1, price: 4999, status: '已完成', date: '2023-01-15' },
      { id: 1002, userId: 2, productId: 103, quantity: 1, price: 7999, status: '已完成', date: '2023-02-20' },
      { id: 1003, userId: 3, productId: 105, quantity: 2, price: 1798, status: '运输中', date: '2023-03-05' },
      { id: 1004, userId: 4, productId: 102, quantity: 1, price: 3499, status: '已完成', date: '2023-03-10' },
      { id: 1005, userId: 5, productId: 104, quantity: 1, price: 1999, status: '待发货', date: '2023-03-18' }
    ];
  }
  
  // 默认返回一些通用统计数据
  return [
    { metric: '总用户数', value: 1243, change: '+5.2%' },
    { metric: '月活跃用户', value: 867, change: '+3.8%' },
    { metric: '总订单数', value: 8765, change: '+12.1%' },
    { metric: '平均订单金额', value: 2345.67, change: '-2.3%' },
    { metric: '客户满意度', value: '4.6/5.0', change: '+0.2' }
  ];
}; 