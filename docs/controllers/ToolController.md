# ToolController

The `ToolController` is responsible for managing the lifecycle of Tool resources within the Mastra runtime system. It handles the validation, initialization, and state management of tools that can be used by AI agents.

## Purpose

The ToolController ensures that:
- Tool resources have valid configurations
- Tool execution functions are properly resolved
- Tool state is initialized and maintained
- Events are published when tool status changes

## Implementation

The ToolController extends the AbstractController base class and implements the required methods for resource management:

```typescript
export class ToolController extends AbstractController<ToolResource> {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  async getDesiredState(resource: ToolResource): Promise<any> { /* ... */ }
  
  async getCurrentState(resource: ToolResource): Promise<any> { /* ... */ }
  
  protected async updateResourceState(
    resource: ToolResource, 
    desiredState: any, 
    currentState: any
  ): Promise<void> { /* ... */ }
  
  protected async cleanupResource(resource: ToolResource): Promise<void> { /* ... */ }
}
```

## Key Features

### 1. Tool Validation

The controller validates tool resources to ensure they have the required properties:
- A unique identifier (`id`)
- A description of the tool's functionality
- An execute function path to run the tool

### 2. State Management

The controller initializes and manages the tool's state throughout its lifecycle, including:
- Creating a Ready condition when the tool is initialized
- Publishing events when the tool is reconciled or cleaned up
- Tracking metadata about the tool (creation time, schemas, etc.)

### 3. Event Publishing

The controller emits events to notify the system of tool lifecycle changes:
- `tool.reconciled`: Published when a tool is successfully reconciled
- `tool.cleaned`: Published when a tool is cleaned up (deleted)

## Example Usage

### Creating a Tool Resource

```typescript
// Define a tool resource
const myTool: ToolResource = {
  apiVersion: 'mastra.ai/v1',
  kind: 'Tool',
  metadata: {
    name: 'my-calculator',
    namespace: 'default'
  },
  spec: {
    id: 'calculator',
    description: 'A simple calculator tool',
    execute: 'path/to/calculator.js',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['operation', 'a', 'b']
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'number' }
      }
    }
  }
};

// Create an EventBus
const eventBus = new EventBus();

// Create a ToolController
const toolController = new ToolController(eventBus);

// Watch the tool resource
toolController.watch(myTool);

// Reconcile the tool resource
await toolController.reconcile(myTool);
```

### Listening for Tool Events

```typescript
// Subscribe to tool reconciliation events
eventBus.subscribe('tool.reconciled', (event) => {
  console.log(`Tool ${event.resource.metadata.name} reconciled`);
  console.log('Tool state:', event.state);
});

// Subscribe to tool cleanup events
eventBus.subscribe('tool.cleaned', (event) => {
  console.log(`Tool ${event.resource.metadata.name} cleaned up`);
});
```

## Error Handling

The ToolController implements robust error handling:
- Validation errors are thrown with descriptive messages
- Errors during state retrieval are logged and properly propagated
- Errors during cleanup are caught and logged to prevent cascading failures

## Testing

The ToolController has comprehensive tests covering:
- Initialization and basic functionality
- Validation of tool resources
- State management
- Event publishing
- Error handling

Tests can be found in `test/core/controllers/tool-controller.test.ts` 