import { promises as fs } from 'fs';
import { load } from 'js-yaml';
import path from 'path';
import { validateRootConfig, RootConfig } from './types/root';
import { ConfigError, ValidationError } from './utils/errors';
import { resolveEnvVariables } from './types/common';

/**
 * 配置加载器 - 负责从文件或字符串加载和验证配置
 */
export class ConfigLoader {
  /**
   * 从文件加载配置
   * @param filePath 配置文件路径
   * @returns 加载的配置对象
   */
  static async loadFromFile(filePath: string): Promise<RootConfig> {
    try {
      // 读取文件
      const content = await fs.readFile(filePath, 'utf8');
      
      // 解析YAML
      return ConfigLoader.loadFromString(content);
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      
      throw new ConfigError(
        `Failed to load configuration from file: ${error instanceof Error ? error.message : String(error)}`,
        { filePath, error }
      );
    }
  }
  
  /**
   * 从YAML字符串加载配置
   * @param yamlString YAML字符串
   * @returns 加载的配置对象
   */
  static loadFromString(yamlString: string): RootConfig {
    try {
      // 解析YAML
      const config = load(yamlString) as any;
      
      // 处理环境变量
      const resolvedConfig = resolveEnvVariables(config);
      
      // 验证配置
      return validateRootConfig(resolvedConfig);
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      
      throw new ConfigError(
        `Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }
  
  /**
   * 验证配置对象
   * @param config 配置对象
   * @returns 验证后的配置对象
   */
  static validate(config: any): RootConfig {
    try {
      return validateRootConfig(config);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
        { config, error }
      );
    }
  }
}
