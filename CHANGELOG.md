# Changelog

## 0.2.0 (2023-07-10)

### Features

- Implemented Kubernetes-inspired declarative architecture
- Added AbstractController with core lifecycle management functionality
- Implemented concrete controllers (AgentController, WorkflowController, NetworkController)
- Added event-driven architecture with EventBus
- Implemented NetworkExecutor for agent network coordination
- Added WorkflowExecutor for sequential workflow execution
- Added comprehensive error handling and status management
- Improved test coverage with 29 passing test cases
- Added detailed documentation in runtimes.md

### Bug Fixes

- Fixed AgentController error handling to properly initialize status objects
- Fixed handling of resource watching events
- Fixed data passing in workflow steps
- Fixed status update handling in error cases

### Documentation

- Updated runtimes.md with implementation status
- Added detailed API documentation
- Created comprehensive README.md with usage examples

## 0.1.0 (2023-06-15)

### Features

- Initial release
- Basic YAML configuration loading
- Support for Agent, Tool, and Workflow configuration
- Type-safe validation using zod
- Basic tool execution environment 