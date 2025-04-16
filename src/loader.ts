import { readFile } from 'fs/promises';
import { load } from 'js-yaml';
import { RootConfigSchema, RootConfig } from './types';

export class ConfigLoader {
  /**
   * 从文件加载配置
   * @param filePath 配置文件路径
   */
  static async loadFromFile(filePath: string): Promise<RootConfig> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.loadFromString(content);
    } catch (error) {
      throw new Error(`Failed to load config file: ${filePath}\n${error.message}`);
    }
  }

  /**
   * 从字符串加载配置
   * @param yamlContent YAML 内容
   */
  static async loadFromString(yamlContent: string): Promise<RootConfig> {
    try {
      const config = load(yamlContent);
      return this.validateConfig(config);
    } catch (error) {
      throw new Error(`Failed to parse YAML content:\n${error.message}`);
    }
  }

  /**
   * 验证配置对象
   * @param config 配置对象
   */
  static validateConfig(config: unknown): RootConfig {
    try {
      return RootConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid configuration:\n${error.message}`);
    }
  }
}
