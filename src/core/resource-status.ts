/**
 * Resource Status defines the possible states for resources in workflows
 */
export enum ResourceStatus {
  PENDING = 'pending',   // Resource is waiting to be processed
  LOADING = 'loading',   // Resource is being loaded or processed
  READY = 'ready',       // Resource is ready and available for use
  ERROR = 'error',       // Resource has encountered an error
  STALE = 'stale',       // Resource is outdated and needs refresh
  CANCELED = 'canceled', // Resource processing was canceled
}

/**
 * ResourceState represents the current state of a resource
 */
export interface ResourceState {
  status: ResourceStatus;
  error?: string;
  lastUpdated?: Date;
  metadata?: Record<string, any>;
}

/**
 * Create a new resource state with the given status
 */
export function createResourceState(
  status: ResourceStatus = ResourceStatus.PENDING,
  metadata?: Record<string, any>
): ResourceState {
  return {
    status,
    lastUpdated: new Date(),
    metadata
  };
}

/**
 * Update a resource state with new values
 */
export function updateResourceState(
  state: ResourceState,
  updates: Partial<ResourceState>
): ResourceState {
  return {
    ...state,
    ...updates,
    lastUpdated: new Date()
  };
}

/**
 * Check if a resource is in a terminal state
 */
export function isTerminalState(state: ResourceState): boolean {
  return state.status === ResourceStatus.READY || 
         state.status === ResourceStatus.ERROR ||
         state.status === ResourceStatus.CANCELED;
}

/**
 * Check if a resource is in a loading state
 */
export function isLoadingState(state: ResourceState): boolean {
  return state.status === ResourceStatus.PENDING || 
         state.status === ResourceStatus.LOADING;
}

/**
 * Check if a resource is in an error state
 */
export function isErrorState(state: ResourceState): boolean {
  return state.status === ResourceStatus.ERROR;
}

/**
 * Format a resource state as a readable string
 */
export function formatResourceState(state: ResourceState): string {
  let formatted = `Status: ${state.status}`;
  
  if (state.error) {
    formatted += `, Error: ${state.error}`;
  }
  
  if (state.lastUpdated) {
    formatted += `, Last Updated: ${state.lastUpdated.toISOString()}`;
  }
  
  return formatted;
} 