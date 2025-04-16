import { Plugin, PluginContext } from '../core/plugin-system';

/**
 * 日志记录插件
 * 为Mastra Runtime提供统一的日志记录功能
 */
export class LoggerPlugin implements Plugin {
  id = 'mastra:logger';
  name = 'Mastra Logger';
  version = '1.0.0';
  description = '为Mastra Runtime提供统一的日志记录功能';
  
  private context: PluginContext | null = null;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  
  /**
   * 初始化插件
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // 从配置获取日志级别，如果没有则使用默认值
    const configLevel = context.getConfig('logLevel');
    if (configLevel) {
      this.logLevel = configLevel;
    }
    
    // 注册命令
    context.registerCommand('logger.setLevel', this.setLogLevel.bind(this));
    context.registerCommand('logger.getLevel', this.getLogLevel.bind(this));
    
    // 监听资源事件
    context.eventBus.subscribe('Agent.created', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Agent.deleted', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Tool.created', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Tool.deleted', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Workflow.created', this.logResourceEvent.bind(this));
    context.eventBus.subscribe('Workflow.deleted', this.logResourceEvent.bind(this));
    
    // 监听错误事件
    context.eventBus.subscribe('*.failed', this.logErrorEvent.bind(this));
    context.eventBus.subscribe('*.error', this.logErrorEvent.bind(this));
    
    this.info('Logger plugin initialized');
  }
  
  /**
   * 卸载插件
   */
  async uninstall(): Promise<void> {
    if (!this.context) return;
    
    // 清理事件监听
    const events = [
      'Agent.created', 'Agent.deleted', 
      'Tool.created', 'Tool.deleted', 
      'Workflow.created', 'Workflow.deleted',
      '*.failed', '*.error'
    ];
    
    for (const event of events) {
      this.context.eventBus.off(event as any, this.logResourceEvent);
    }
    
    this.info('Logger plugin uninstalled');
    this.context = null;
  }
  
  /**
   * 设置日志级别
   */
  private async setLogLevel(args: { level: 'debug' | 'info' | 'warn' | 'error' }): Promise<void> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }
    
    const { level } = args;
    this.logLevel = level;
    this.context.setConfig('logLevel', level);
    
    this.info(`Log level set to ${level}`);
  }
  
  /**
   * 获取日志级别
   */
  private async getLogLevel(): Promise<string> {
    return this.logLevel;
  }
  
  /**
   * 记录资源事件
   */
  private logResourceEvent(data: any): void {
    const eventName = data.eventName || 'unknown';
    const resourceType = eventName.split('.')[0];
    const action = eventName.split('.')[1];
    
    let resourceId = 'unknown';
    
    if (data.resource) {
      resourceId = data.resource.metadata?.name || 'unknown';
    } else if (data.agent) {
      resourceId = data.agent.name || 'unknown';
    }
    
    this.info(`Resource event: ${resourceType} ${resourceId} ${action}`);
  }
  
  /**
   * 记录错误事件
   */
  private logErrorEvent(data: any): void {
    const error = data.error || 'Unknown error';
    const resource = data.resource || {};
    
    let resourceId = 'unknown';
    if (resource.metadata?.name) {
      resourceId = resource.metadata.name;
    }
    
    this.error(`Error: ${error}`, {
      resourceId,
      resourceType: resource.kind || 'unknown',
      details: data
    });
  }
  
  /**
   * 记录调试级别日志
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, context);
    }
  }
  
  /**
   * 记录信息级别日志
   */
  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.log('INFO', message, context);
    }
  }
  
  /**
   * 记录警告级别日志
   */
  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, context);
    }
  }
  
  /**
   * 记录错误级别日志
   */
  error(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      this.log('ERROR', message, context);
    }
  }
  
  /**
   * 判断是否应该记录日志
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }
  
  /**
   * 实际记录日志的方法
   */
  private log(level: string, message: string, context?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.info(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'ERROR':
        console.error(logMessage);
        break;
      default:
        console.log(logMessage);
    }
    
    if (context) {
      console.log(context);
    }
    
    // 如果插件已初始化，发布日志事件
    if (this.context) {
      this.context.eventBus.publish('logger.log', {
        level,
        message,
        timestamp,
        context
      });
    }
  }
} 