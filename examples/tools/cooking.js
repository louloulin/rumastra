// cooking.js
// 厨师助手工具，提供食谱建议

/**
 * 输入模式 (JSON Schema 格式)
 */
const inputSchema = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "string"
      },
      description: "List of ingredients"
    }
  },
  required: ["ingredients"]
};

/**
 * 输出模式 (JSON Schema 格式)
 */
const outputSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "string"
      },
      description: "List of possible recipes"
    }
  },
  required: ["recipes"]
};

// 示例食谱数据库
const RECIPE_DATABASE = [
  {
    name: 'Spaghetti Carbonara',
    ingredients: ['pasta', 'eggs', 'bacon', 'parmesan cheese', 'black pepper'],
  },
  {
    name: 'Simple Omelette',
    ingredients: ['eggs', 'butter', 'salt', 'pepper'],
  },
  {
    name: 'Chicken Stir Fry',
    ingredients: ['chicken', 'vegetables', 'soy sauce', 'oil'],
  },
  {
    name: 'Grilled Cheese Sandwich',
    ingredients: ['bread', 'cheese', 'butter'],
  },
  {
    name: 'Pancakes',
    ingredients: ['flour', 'eggs', 'milk', 'butter', 'sugar'],
  },
  {
    name: 'Vegetable Soup',
    ingredients: ['vegetables', 'broth', 'salt', 'pepper', 'herbs'],
  }
];

/**
 * 检查食谱是否可以用给定的食材制作
 * @param {Object} recipe 食谱
 * @param {string[]} availableIngredients 可用食材
 * @returns {boolean} 是否可以制作
 */
function canMakeRecipe(recipe, availableIngredients) {
  const lowercaseAvailable = availableIngredients.map(i => i.toLowerCase());
  return recipe.ingredients.every(ingredient => 
    lowercaseAvailable.some(available => available.includes(ingredient))
  );
}

/**
 * 查找可以用给定食材制作的食谱
 * @param {Object} input 输入对象，包含食材列表
 * @returns {Promise<Object>} 返回可能的食谱列表
 */
async function execute(input) {
  console.log("执行厨师工具，输入:", input);
  
  // 确保输入有效
  if (!input || !Array.isArray(input.ingredients)) {
    throw new Error("Invalid input: ingredients must be an array");
  }
  
  // 查找匹配的食谱
  const possibleRecipes = RECIPE_DATABASE
    .filter(recipe => canMakeRecipe(recipe, input.ingredients))
    .map(recipe => recipe.name);
  
  // 返回结果
  return {
    recipes: possibleRecipes.length > 0
      ? possibleRecipes
      : ['No recipes found with the given ingredients. Try adding more ingredients!']
  };
}

// 导出模块
module.exports = {
  inputSchema,
  outputSchema,
  execute
}; 