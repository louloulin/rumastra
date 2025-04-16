// mock-cooking.js - ES Module版本的烹饪工具实现

// 模拟食谱数据库
const RECIPES = [
  {
    name: "奶酪三明治",
    ingredients: ["面包", "奶酪", "黄油"]
  },
  {
    name: "炒鸡蛋",
    ingredients: ["鸡蛋", "油", "盐", "葱"]
  },
  {
    name: "简易披萨",
    ingredients: ["面包", "奶酪", "番茄酱", "香肠"]
  },
  {
    name: "香肠炒饭",
    ingredients: ["米饭", "香肠", "鸡蛋", "蔬菜"]
  },
  {
    name: "奶酪蛋卷",
    ingredients: ["鸡蛋", "奶酪", "牛奶", "盐"]
  }
];

// 输入模式定义（JSON Schema格式）
export const inputSchema = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "string"
      },
      description: "可用的食材列表"
    }
  },
  required: ["ingredients"]
};

// 输出模式定义（JSON Schema格式）
export const outputSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "string"
      },
      description: "可制作的食谱列表"
    }
  }
};

/**
 * 检查食谱是否可以用给定的食材制作
 * @param {Object} recipe 食谱对象
 * @param {Array<string>} availableIngredients 可用食材
 * @returns {Object} 匹配结果：{match: boolean, matchedCount: number, totalNeeded: number}
 */
function checkRecipeMatch(recipe, availableIngredients) {
  // 将食材统一为小写以便比较
  const ingredients = availableIngredients.map(i => i.toLowerCase());
  const recipeIngredients = recipe.ingredients.map(i => i.toLowerCase());
  
  let matchedCount = 0;
  const totalNeeded = recipeIngredients.length;
  
  // 计算匹配的食材数量
  for (const needed of recipeIngredients) {
    if (ingredients.some(available => available.includes(needed) || needed.includes(available))) {
      matchedCount++;
    }
  }
  
  // 计算匹配率
  const matchRate = matchedCount / totalNeeded;
  
  // 匹配率0.7以上(70%)视为可以制作
  const canMake = matchRate >= 0.7; 
  
  return {
    match: canMake,
    matchRate: matchRate,
    matchedCount: matchedCount,
    totalNeeded: totalNeeded
  };
}

/**
 * 查找可以用给定食材制作的食谱
 * @param {Object} input 输入对象，包含食材列表
 * @returns {Object} 输出对象，包含可制作的食谱
 */
export async function execute(input) {
  console.log("执行ES Module版本烹饪工具查询，输入食材:", input.ingredients);

  // 验证输入
  if (!input || !Array.isArray(input.ingredients)) {
    return { recipes: ["错误：请提供食材列表"] };
  }

  // 存储食谱匹配结果
  const matchResults = [];
  
  // 分析每个食谱
  for (const recipe of RECIPES) {
    const matchResult = checkRecipeMatch(recipe, input.ingredients);
    
    // 添加食谱名称到结果
    if (matchResult.match) {
      matchResults.push({
        name: recipe.name,
        matchRate: matchResult.matchRate,
        matchedCount: matchResult.matchedCount,
        totalNeeded: matchResult.totalNeeded
      });
    }
  }
  
  // 按匹配率排序
  matchResults.sort((a, b) => b.matchRate - a.matchRate);

  // 返回结果
  if (matchResults.length > 0) {
    return { 
      recipes: matchResults.map(result => 
        `${result.name} (ESM版本, 匹配度: ${Math.round(result.matchRate * 100)}%, 找到${result.matchedCount}/${result.totalNeeded}种食材)`
      )
    };
  } else {
    return { recipes: ["未找到匹配的食谱，请尝试提供更多食材"] };
  }
}

// 默认导出
export default {
  inputSchema,
  outputSchema,
  execute
}; 