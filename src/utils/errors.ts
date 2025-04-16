/**
 * 基础错误类
 */
export class MastraError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    
    // 捕获堆栈跟踪
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 配置错误类
 */
export class ConfigError extends MastraError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
  }
}

/**
 * 资源不存在错误类
 */
export class NotFoundError extends MastraError {
  constructor(resourceType: string, resourceId: string, details?: any) {
    super(`${resourceType} not found: ${resourceId}`, 'NOT_FOUND', details);
  }
}

/**
 * 执行错误类
 */
export class ExecutionError extends MastraError {
  constructor(message: string, details?: any) {
    super(message, 'EXECUTION_ERROR', details);
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends MastraError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * 超时错误类
 */
export class TimeoutError extends MastraError {
  constructor(operation: string, timeoutMs: number, details?: any) {
    super(`Operation ${operation} timed out after ${timeoutMs}ms`, 'TIMEOUT', details);
  }
}

/**
 * 安全地记录错误
 * @param error 错误对象
 * @param context 上下文信息
 */
export function logError(error: any, context?: string): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  // 构建错误对象
  const logEntry = {
    message: errorObj.message,
    name: errorObj.name,
    stack: errorObj.stack,
    context: context || 'unknown',
    timestamp: new Date().toISOString(),
    code: error instanceof MastraError ? error.code : 'UNKNOWN',
    details: error instanceof MastraError ? error.details : undefined
  };
  
  // 输出错误日志
  console.error(JSON.stringify(logEntry));
}

/**
 * 处理异步错误
 * @param promise Promise对象
 * @returns 结果和错误的元组
 */
export async function handleAsyncError<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * 创建超时Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param operation 操作名称
 * @returns 超时Promise
 */
export function createTimeout(timeoutMs: number, operation: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });
}

/**
 * 带超时的Promise执行
 * @param promise 原始Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param operation 操作名称
 * @returns 带超时的Promise
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    createTimeout(timeoutMs, operation)
  ]);
} 