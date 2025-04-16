// Export types
export * from './types';

// Export loader class
export { ConfigLoader } from './loader';

// Export builder
export { RuntimeBuilder } from './builder';

// Export script executor utilities
export { createToolExecutor, validateToolScript } from './toolExecutor';

// Export utilities
export { dynamicImport } from './utils';

// Export DSL Parser
export { DSLParser } from './core/dsl-parser';

// Export Network related classes and interfaces
export { NetworkState } from './core/network/state';
export { InMemoryNetworkStateStore } from './core/network/store';
export type { NetworkStateStore } from './core/network/store';
export { NetworkController } from './core/network/controller';
export { NetworkExecutor } from './core/network/executor';
export type { 
  GenerationResult, 
  StreamResult, 
  NetworkGenerateOptions, 
  NetworkStreamOptions 
} from './core/network/types';

// Export EventBus
export { EventBus, type TypedEventEmitter, type Subscription, type EventHandler, type EventListener } from './core/eventbus';

export { AbstractController } from './core/controller';
export type { Controller } from './core/controller';
export { RuntimeManager } from './core/runtime-manager';
// Export CLI Runtime Manager
export { CLIRuntimeManager } from './core/cli-runtime-manager';

// Export storage related classes and interfaces
export type { StateStore } from './core/storage/store';
export { InMemoryStateStore, FileSystemStateStore, createStateStore } from './core/storage/store';
export { DatabaseStateStore } from './core/storage/database-store';

// Export simplified API
export { 
  SimpleResourceManager, 
  createSimpleResourceManager, 
  loadResources, 
  loadAndRegister 
} from './simple-api';

// Export new MastraPod API
export {
  MastraPod,
  loadFile,
  loadContent,
  createApp,
  run
} from './mastra-api';

export type {
  MastraPodOptions,
  MastraPodLoadOptions,
  AgentRunOptions,
  WorkflowRunOptions,
  ToolCallOptions,
  AgentResponse,
  WorkflowResponse,
  ToolResponse,
  RunOptions
} from './mastra-api';

import { Mastra } from '@mastra/core';
import { RuntimeBuilder } from './builder';
import { ConfigLoader } from './loader';

/**
 * Build a Mastra instance from config object
 */
export async function buildFromConfig(
  config: any, 
  basePath: string = process.cwd()
): Promise<RuntimeBuilder> {
  const builder = new RuntimeBuilder(config, basePath);
  await builder.build();
  return builder;
}

/**
 * Load and build from a config file, returning the RuntimeBuilder
 */
export async function loadFromFile(
  filePath: string,
  basePath: string = process.cwd()
): Promise<RuntimeBuilder> {
  const config = await ConfigLoader.loadFromFile(filePath);
  return buildFromConfig(config, basePath);
}

/**
 * Load and build from a YAML string, returning the RuntimeBuilder
 */
export async function loadFromString(
  yamlString: string,
  basePath: string = process.cwd()
): Promise<RuntimeBuilder> {
  const config = await ConfigLoader.loadFromString(yamlString);
  return buildFromConfig(config, basePath);
}

/**
 * Load and build a Mastra instance from a config file
 */
export async function loadMastraFromFile(
  filePath: string,
  basePath: string = process.cwd()
): Promise<Mastra> {
  const builder = await loadFromFile(filePath, basePath);
  return await builder.build();
}

/**
 * Load and build a Mastra instance from a YAML string
 */
export async function loadMastraFromString(
  yamlString: string,
  basePath: string = process.cwd()
): Promise<Mastra> {
  const builder = await loadFromString(yamlString, basePath);
  return await builder.build();
}
