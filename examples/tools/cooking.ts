import { z } from 'zod';

// 输入模式
const InputSchema = z.object({
  ingredients: z.array(z.string()).describe('List of ingredients'),
});

// 输出模式
const OutputSchema = z.object({
  recipes: z.array(z.string()).describe('List of possible recipes'),
});

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
];

/**
 * 检查食谱是否可以用给定的食材制作
 * @param recipe 食谱
 * @param availableIngredients 可用食材
 * @returns 是否可以制作
 */
function canMakeRecipe(recipe: (typeof RECIPE_DATABASE)[0], availableIngredients: string[]): boolean {
  const lowercaseAvailable = availableIngredients.map(i => i.toLowerCase());
  return recipe.ingredients.every(ingredient => lowercaseAvailable.some(available => available.includes(ingredient)));
}

/**
 * 查找可以用给定食材制作的食谱
 */
export async function execute(input: z.infer<typeof InputSchema>): Promise<z.infer<typeof OutputSchema>> {
  const possibleRecipes = RECIPE_DATABASE.filter(recipe => canMakeRecipe(recipe, input.ingredients)).map(
    recipe => recipe.name,
  );

  return {
    recipes:
      possibleRecipes.length > 0
        ? possibleRecipes
        : ['No recipes found with the given ingredients. Try adding more ingredients!'],
  };
}

// 导出类型定义
export type { InputSchema, OutputSchema };
