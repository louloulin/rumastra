/**
 * 示例天气工具实现
 */
export default async function getWeather(params) {
  // 这只是一个模拟实现
  const { location } = params;
  
  // 模拟API调用
  console.log(`获取 ${location} 的天气信息`);
  
  // 随机天气数据
  const conditions = ['晴朗', '多云', '小雨', '大雨', '雷雨', '大风'];
  const temperatures = Array.from({ length: 10 }, (_, i) => 20 + i);
  
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const randomTemperature = temperatures[Math.floor(Math.random() * temperatures.length)];
  
  // 返回天气信息
  return {
    location,
    condition: randomCondition,
    temperature: randomTemperature,
    unit: 'celsius',
    timestamp: new Date().toISOString()
  };
} 