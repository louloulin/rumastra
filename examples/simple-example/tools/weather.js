/**
 * 天气查询工具
 * 
 * 此工具模拟查询天气API，返回指定位置的天气信息
 */

export default async function weatherTool(params) {
  const { location } = params;

  if (!location) {
    return {
      error: "Location is required",
      status: 400
    };
  }

  // 模拟不同位置的天气响应
  const weatherData = {
    "New York": {
      temperature: 22,
      condition: "Partly Cloudy",
      humidity: 65,
      wind: "10 mph"
    },
    "London": {
      temperature: 18,
      condition: "Rainy",
      humidity: 80,
      wind: "15 mph"
    },
    "Tokyo": {
      temperature: 28,
      condition: "Sunny",
      humidity: 45,
      wind: "8 mph"
    },
    "Sydney": {
      temperature: 25,
      condition: "Clear",
      humidity: 50,
      wind: "12 mph"
    }
  };

  // 如果提供的位置不在我们的模拟数据中，返回随机天气
  if (!weatherData[location]) {
    return {
      temperature: Math.floor(15 + Math.random() * 20),
      condition: ["Sunny", "Cloudy", "Rainy", "Partly Cloudy"][Math.floor(Math.random() * 4)],
      humidity: Math.floor(40 + Math.random() * 50),
      wind: `${Math.floor(5 + Math.random() * 15)} mph`,
      location: location,
      note: "Generated random weather data for this location"
    };
  }

  return {
    ...weatherData[location],
    location: location
  };
} 