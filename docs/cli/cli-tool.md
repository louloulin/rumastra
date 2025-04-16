# Mastra CLI Tool

The Mastra CLI Tool provides a powerful command-line interface for managing and interacting with Mastra resources using a Kubernetes-inspired declarative approach. This document outlines the capabilities, usage patterns, and best practices for the Mastra CLI.

## Installation

The Mastra CLI is installed automatically when you install the Mastra Runtimes package:

```bash
# Using npm
npm install kastra

# Using yarn
yarn add kastra

# Using pnpm
pnpm add kastra
```

Once installed, you can access the CLI using the `mastra` command:

```bash
# Display CLI help
mastra --help
```

## Core Concepts

The Mastra CLI follows these core principles:

1. **Declarative Resource Management**: Resources are defined in YAML files and applied to the runtime.
2. **Kubernetes-like Command Structure**: Commands follow patterns familiar to Kubernetes users.
3. **Resource Lifecycle Management**: Create, update, delete, and query resources.
4. **Runtime Control**: Execute and interact with agents, workflows, and networks.

## Command Structure

The Mastra CLI uses the following command structure:

```
mastra <command> <subcommand> [options]
```

### Global Options

The following options are available for all commands:

- `--help, -h`: Display help information for a command
- `--version, -v`: Display version information
- `--config <path>`: Specify a custom configuration file
- `--namespace, -n <namespace>`: Specify the namespace (default: "default")
- `--output, -o <format>`: Specify output format (json, yaml, table)

## Resource Management Commands

### Apply

Apply a resource definition from a file:

```bash
mastra apply -f <file-path>
```

Options:
- `-f, --file <file-path>`: Path to the resource file
- `--dry-run`: Validate but don't apply the resource

Examples:
```bash
# Apply a single resource
mastra apply -f agent.yaml

# Apply all resources in a directory
mastra apply -f ./resources/

# Apply multiple resources
mastra apply -f agent.yaml -f workflow.yaml
```

### Delete

Delete a resource:

```bash
mastra delete <kind> <name> [options]
```

Options:
- `--force`: Force deletion without confirmation
- `--cascade`: Delete dependent resources (default: true)

Examples:
```bash
# Delete an agent
mastra delete agent my-agent

# Delete a workflow in a specific namespace
mastra delete workflow my-workflow --namespace production

# Force delete an agent
mastra delete agent my-agent --force
```

### Get

Get information about resources:

```bash
mastra get <kind> [name] [options]
```

Options:
- `-o, --output <format>`: Output format (json, yaml, table)
- `-w, --watch`: Watch for changes
- `-l, --selector <selector>`: Filter by label selector

Examples:
```bash
# List all agents
mastra get agents

# Get detailed information about a specific agent
mastra get agent my-agent

# Get workflow details in YAML format
mastra get workflow my-workflow -o yaml

# Watch for changes to agents
mastra get agents --watch
```

### Describe

Get detailed information about a resource:

```bash
mastra describe <kind> <name> [options]
```

Examples:
```bash
# Get detailed information about an agent
mastra describe agent my-agent

# Get detailed information about a workflow
mastra describe workflow my-workflow
```

## Runtime Control Commands

### Run

Execute a resource:

```bash
mastra run <kind> <name> [options]
```

Options:
- `--input <json>`: Input data in JSON format
- `--timeout <seconds>`: Execution timeout
- `--async`: Run asynchronously and return a job ID

Examples:
```bash
# Run an agent with input
mastra run agent my-agent --input '{"query": "What is the weather?"}'

# Run a workflow
mastra run workflow my-workflow --input '{"location": "New York"}'

# Run a network asynchronously
mastra run network my-network --async
```

### Logs

View logs for a resource:

```bash
mastra logs <kind> <name> [options]
```

Options:
- `-f, --follow`: Follow log output
- `--since <time>`: Show logs since timestamp or relative time
- `--tail <lines>`: Number of lines to show from the end

Examples:
```bash
# View agent logs
mastra logs agent my-agent

# Follow workflow logs
mastra logs workflow my-workflow -f

# Show recent network logs
mastra logs network my-network --since 5m
```

### Status

Check the status of the Mastra runtime:

```bash
mastra status [options]
```

Options:
- `--detail`: Show detailed status information

## Configuration Commands

### Config

Manage CLI configuration:

```bash
mastra config <subcommand> [options]
```

Subcommands:
- `set <key> <value>`: Set a configuration value
- `get <key>`: Get a configuration value
- `unset <key>`: Remove a configuration value
- `view`: Show current configuration

Examples:
```bash
# Set default namespace
mastra config set namespace production

# View current configuration
mastra config view
```

## Advanced Commands

### Import

Import resources from a directory:

```bash
mastra import <directory> [options]
```

Options:
- `--recursive`: Recursively import resources from subdirectories
- `--dry-run`: Validate but don't apply resources

Examples:
```bash
# Import all resources from a directory
mastra import ./resources

# Recursively import resources with validation only
mastra import ./project --recursive --dry-run
```

### Export

Export resources to files:

```bash
mastra export <kind> [name] [options]
```

Options:
- `--output-dir <directory>`: Directory to store exported files
- `--format <format>`: Export format (yaml, json)

Examples:
```bash
# Export all agents to files
mastra export agents --output-dir ./backup

# Export a specific workflow
mastra export workflow my-workflow --output-dir ./backup
```

### Validate

Validate resource definitions:

```bash
mastra validate -f <file-path>
```

Options:
- `-f, --file <file-path>`: Path to the resource file
- `--strict`: Enable strict validation

Examples:
```bash
# Validate a single resource
mastra validate -f agent.yaml

# Validate all resources in a directory
mastra validate -f ./resources/
```

## Resource Types

The Mastra CLI supports the following resource types:

### Agent

An AI agent with instructions, model configuration, and optional tools:

```yaml
apiVersion: mastra.ai/v1
kind: Agent
metadata:
  name: weather-agent
  namespace: demo
spec:
  instructions: "You are a weather information agent..."
  model:
    provider: openai
    name: gpt-4
  tools:
    - type: function
      function:
        name: getCurrentWeather
        description: "Get current weather information"
        # ...
```

### Workflow

A sequence of steps that can include agents, functions, and conditions:

```yaml
apiVersion: mastra.ai/v1
kind: Workflow
metadata:
  name: weather-workflow
  namespace: demo
spec:
  steps:
    - id: validateInput
      type: function
      # ...
    - id: getWeatherInfo
      type: agent
      # ...
```

### Network

A collaborative network of agents with routing logic:

```yaml
apiVersion: mastra.ai/v1
kind: Network
metadata:
  name: support-network
  namespace: demo
spec:
  agents:
    - name: greeter
      ref: demo.greeter-agent
    - name: technical
      ref: demo.technical-agent
  router:
    model:
      provider: openai
      name: gpt-4
```

### Tool

A reusable tool that can be referenced by agents:

```yaml
apiVersion: mastra.ai/v1
kind: Tool
metadata:
  name: weather-tool
  namespace: demo
spec:
  type: function
  function:
    name: getWeather
    description: "Get weather information"
    # ...
```

### MastraPod

A collection of resources with shared configuration:

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: weather-app
  namespace: demo
spec:
  config:
    # Global configuration
  resources:
    # Resource definitions
```

## Best Practices

### Resource Organization

1. **Namespace Organization**: Use namespaces to group related resources
2. **Structured Directory Layout**:
   ```
   resources/
   ├── agents/
   ├── workflows/
   ├── networks/
   ├── tools/
   └── pod.yaml
   ```
3. **Resource References**: Use consistent naming for resource references

### Resource Definitions

1. **Documentation**: Include detailed comments in resource files
2. **Validation**: Always validate resources before applying
3. **Versioning**: Use version control for resource definitions
4. **Modularity**: Create reusable components with clear interfaces

### CLI Usage

1. **Scripting**: Create scripts for common operations
2. **CI/CD Integration**: Integrate with CI/CD pipelines
3. **Environment Variables**: Use environment variables for secrets
4. **Idempotent Operations**: Design for repeated application of resources

## Troubleshooting

### Common Issues

1. **Resource Not Found**: Check namespace and resource name
2. **Validation Errors**: Verify resource schema
3. **Execution Failures**: Check logs for error messages
4. **Permission Issues**: Verify API keys and access permissions

### Debugging Tips

1. **Increase Verbosity**: Use `--verbose` flag for detailed output
2. **Check Logs**: Use `mastra logs` for detailed execution logs
3. **Validate Resources**: Use `mastra validate` before applying
4. **Check Status**: Use `mastra status` to verify runtime health

## Customizing the CLI

The Mastra CLI can be customized through:

1. **Configuration Files**: Create a `.mastrarc` file in your project or home directory
2. **Environment Variables**: Set `MASTRA_*` variables
3. **Plugin System**: Extend functionality with custom plugins

## Advanced Topics

### Automating with Mastra CLI

Create shell scripts or Node.js applications that use the Mastra CLI:

```javascript
// cli-automation.js
const { execSync } = require('child_process');

// Apply resources
execSync('mastra apply -f resources/agent.yaml');

// Run workflow
const result = execSync(
  'mastra run workflow weather-workflow --input \'{"location": "New York"}\'',
  { encoding: 'utf8' }
);

console.log(JSON.parse(result));
```

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Deploy Mastra Resources

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g kastra
      - run: mastra validate -f ./resources/
      - run: mastra apply -f ./resources/
```

## References

- [Mastra Runtimes Documentation](../index.md)
- [Resource Specifications](../resources/resource-spec.md)
- [MastraPod Specification](../resources/pod-spec.md)
- [Runtime Manager API](../api/runtime-manager.md) 