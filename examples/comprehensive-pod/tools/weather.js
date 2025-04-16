/**
 * 模拟天气工具 - 返回指定城市的天气信息
 */
module.exports = async function weather(input) {
  // 解构参数
  const { city } = input;
  
  if (!city) {
    throw new Error('城市名称是必须的');
  }

  console.log(`获取${city}的天气信息`);
  
  // 模拟API请求延迟
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 为不同城市返回不同的模拟数据
  const weatherData = {
    '北京': {
      temperature: 26,
      condition: '晴天',
      humidity: 45
    },
    '上海': {
      temperature: 28,
      condition: '多云',
      humidity: 75
    },
    '广州': {
      temperature: 32,
      condition: '阵雨',
      humidity: 80
    },
    '深圳': {
      temperature: 30,
      condition: '晴天',
      humidity: 70
    }
  };
  
  // 如果城市数据不存在，则返回随机天气
  if (!weatherData[city]) {
    return {
      temperature: Math.floor(Math.random() * 35) + 5, // 5~40
      condition: ['晴天', '多云', '阵雨', '雷阵雨', '小雨', '中雨'][Math.floor(Math.random() * 6)],
      humidity: Math.floor(Math.random() * 70) + 30 // 30~100
    };
  }
  
  return weatherData[city];
}; 