/**
 * 数据库查询工具
 * 
 * 此工具模拟数据库查询操作，支持不同类型的数据库
 */

// 模拟数据库表
const database = {
  users: [
    { id: 1, name: "John Doe", email: "john@example.com", role: "admin" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "user" },
    { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "user" },
    { id: 4, name: "Alice Williams", email: "alice@example.com", role: "manager" },
  ],
  products: [
    { id: 1, name: "Laptop", price: 1200, category: "Electronics", stock: 45 },
    { id: 2, name: "Phone", price: 800, category: "Electronics", stock: 120 },
    { id: 3, name: "Desk Chair", price: 250, category: "Furniture", stock: 30 },
    { id: 4, name: "Coffee Table", price: 180, category: "Furniture", stock: 22 },
    { id: 5, name: "Headphones", price: 150, category: "Electronics", stock: 67 },
  ],
  orders: [
    { id: 1, userId: 1, productIds: [1, 5], total: 1350, date: "2023-10-15" },
    { id: 2, userId: 2, productIds: [2], total: 800, date: "2023-10-16" },
    { id: 3, userId: 3, productIds: [3, 4], total: 430, date: "2023-10-18" },
    { id: 4, userId: 4, productIds: [5], total: 150, date: "2023-10-20" },
    { id: 5, userId: 1, productIds: [2, 3], total: 1050, date: "2023-10-21" },
  ]
};

export default async function databaseTool(params) {
  const { operation, table, query, filters } = params;

  if (!operation) {
    return {
      error: "Operation is required (select, insert, update, etc.)",
      status: 400
    };
  }

  if (!table) {
    return {
      error: "Table name is required",
      status: 400
    };
  }

  // 检查表是否存在
  if (!database[table]) {
    return {
      error: `Table '${table}' does not exist`,
      status: 404
    };
  }

  // 模拟查询操作
  switch (operation.toLowerCase()) {
    case 'select':
      return executeSelect(table, filters);
    case 'count':
      return executeCount(table, filters);
    case 'raw':
      return executeRawQuery(query);
    default:
      return {
        error: `Operation '${operation}' is not supported`,
        status: 400
      };
  }
}

// 执行选择操作
function executeSelect(table, filters = {}) {
  try {
    let results = [...database[table]];
    
    // 应用过滤条件
    if (filters && Object.keys(filters).length > 0) {
      results = results.filter(row => {
        return Object.entries(filters).every(([key, value]) => {
          return row[key] === value;
        });
      });
    }
    
    return {
      data: results,
      count: results.length,
      status: 200
    };
  } catch (error) {
    return {
      error: `Error executing select: ${error.message}`,
      status: 500
    };
  }
}

// 执行计数操作
function executeCount(table, filters = {}) {
  try {
    let count = database[table].length;
    
    // 应用过滤条件
    if (filters && Object.keys(filters).length > 0) {
      count = database[table].filter(row => {
        return Object.entries(filters).every(([key, value]) => {
          return row[key] === value;
        });
      }).length;
    }
    
    return {
      count,
      status: 200
    };
  } catch (error) {
    return {
      error: `Error executing count: ${error.message}`,
      status: 500
    };
  }
}

// 执行原始SQL查询（模拟）
function executeRawQuery(query) {
  if (!query) {
    return {
      error: "Raw query string is required",
      status: 400
    };
  }

  try {
    // 简单解析查询以提供模拟响应
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('select') && lowerQuery.includes('from users')) {
      return {
        data: database.users,
        status: 200
      };
    }
    
    if (lowerQuery.includes('select') && lowerQuery.includes('from products')) {
      return {
        data: database.products,
        status: 200
      };
    }
    
    if (lowerQuery.includes('select') && lowerQuery.includes('from orders')) {
      return {
        data: database.orders,
        status: 200
      };
    }
    
    // 对于其他查询，返回一个消息表示已执行
    return {
      message: `Query executed successfully: ${query}`,
      affectedRows: Math.floor(Math.random() * 10), // 随机影响的行数
      status: 200
    };
  } catch (error) {
    return {
      error: `Error executing raw query: ${error.message}`,
      status: 500
    };
  }
} 