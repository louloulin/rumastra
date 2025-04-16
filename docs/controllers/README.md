# Mastra Runtime Controllers

This directory contains documentation for the controllers in the Mastra Runtime system. Controllers are responsible for managing the lifecycle of resources in the system.

## Available Controllers

### Core Controllers

| Controller | Description | Status |
|------------|-------------|--------|
| [AbstractController](AbstractController.md) | Base controller class providing common functionality | ✅ Implemented |
| [AgentController](AgentController.md) | Manages Agent resources | ✅ Implemented |
| [NetworkController](NetworkController.md) | Manages Network resources | ✅ Implemented |
| [WorkflowController](WorkflowController.md) | Manages Workflow resources | ✅ Implemented |
| [ToolController](ToolController.md) | Manages Tool resources | ✅ Implemented |

## Controller Architecture

Controllers in Mastra Runtime are designed based on the reconciliation pattern, where they:

1. Observe resources of their type
2. Compare the current state with the desired state
3. Take actions to reconcile differences between the states
4. Update resource status to reflect the current state

Each controller implements the following interface:

```typescript
interface Controller<T extends RuntimeResource> {
  // Start watching for resource changes
  watch(resource?: T): void;
  
  // Reconcile resource state
  reconcile(resource: T): Promise<void>;
  
  // Get the desired state for a resource
  getDesiredState(resource: T): Promise<any>;
  
  // Get the current state for a resource
  getCurrentState(resource: T): Promise<any>;
}
```

## Event-Driven Nature

Controllers use an event-driven architecture to react to changes in resources. Events are published to the `EventBus` when:

- Resources are created, updated, or deleted
- Resource reconciliation is completed
- Resource cleanup is performed
- Errors occur during reconciliation

## Testing

Each controller has comprehensive tests to ensure it functions correctly. Tests can be found in `test/core/controllers/`. 