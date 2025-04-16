# Mastra CLI Tools

This directory contains examples and tools that demonstrate the capabilities of the Mastra CLI for managing AI resources using a Kubernetes-inspired declarative approach.

## Overview

Mastra CLI provides a comprehensive set of tools for:

1. **Resource Management**: Create, update, delete, and view resources
2. **Runtime Control**: Execute agents, workflows, and networks with full control
3. **Diagnostics**: Validate configurations and check system status
4. **Utilities**: Import/export resources between environments

## Available Tools

### 1. `weather-cli.js`

A focused example showing how to use the Mastra CLI to deploy and run a weather information workflow.

**Usage:**
```bash
node weather-cli.js <location> [--detailed]
```

**Example:**
```bash
node weather-cli.js "New York" --detailed
```

### 2. `mastra-cli-helper.js`

A comprehensive tool that demonstrates the full capabilities of Mastra CLI for managing and interacting with Mastra resources.

**Usage:**
```bash
node mastra-cli-helper.js <command> [options]
```

**Commands:**
- `apply <file>`: Apply a resource from a file
- `delete <kind> <name>`: Delete a resource
- `get <kind> [name]`: Get resource(s) details
- `run <kind> <name>`: Execute a resource (agent, workflow, network)
- `validate <file>`: Validate a resource file
- `status`: Show runtime status
- `export <kind> <name>`: Export a resource to YAML
- `import <directory>`: Import all resources from a directory
- `help`: Display help information

**Examples:**
```bash
# Apply a resource
node mastra-cli-helper.js apply resources/weather-agent.yaml

# Run a workflow with input
node mastra-cli-helper.js run workflow weather-workflow --input '{"location":"New York"}'

# List all agents
node mastra-cli-helper.js get agents

# Import all resources from a directory
node mastra-cli-helper.js import resources/agents
```

### 3. `create-cli-wrapper.js`

A wizard-based tool that helps you create a customized CLI wrapper for your Mastra project.

**Usage:**
```bash
node create-cli-wrapper.js [output-file]
```

**Features:**
- Interactive wizard for configuration
- Customizable command set based on your needs
- Support for different resource types
- Configurable output formats
- Namespace management

**Example:**
```bash
# Create a custom CLI wrapper named 'my-project-cli.js'
node create-cli-wrapper.js my-project-cli.js

# Follow the wizard prompts to configure your CLI wrapper
# Once generated, use your custom CLI:
node my-project-cli.js <command> [options]
```

The wizard will guide you through the process of creating a custom CLI wrapper, allowing you to:
- Specify your project name
- Select which resource types to support (agents, workflows, networks, tools)
- Choose which features to include (resource management, execution, diagnostics, utilities)
- Set default values like namespace and output format

This is especially useful for teams building applications on top of Mastra, as it provides a simplified, project-specific CLI interface.

## Resource Directory Structure

The `resources` directory follows a structured organization:

```
resources/
├── agents/         # Agent resource definitions
│   └── weather-agent.yaml
├── workflows/      # Workflow resource definitions
│   └── weather-workflow.yaml
├── networks/       # Network resource definitions
├── tools/          # Tool resource definitions
└── pod.yaml        # MastraPod configuration
```

## Best Practices

### Resource Management

1. **Namespace Organization**: Use namespaces to group related resources together
2. **Consistent Naming**: Follow a consistent naming convention for resources
3. **Version Control**: Keep resource definitions in version control
4. **Validation First**: Always validate resources before applying them

### CLI Usage

1. **Scripting**: Use shell scripts or Node.js to automate repetitive tasks
2. **Error Handling**: Always handle errors in production scripts
3. **Environment Variables**: Use environment variables for sensitive information
4. **Idempotency**: Design scripts to be idempotent (can be run multiple times safely)

## Advanced Usage

### Using MastraPod for Resource Groups

MastraPod provides a convenient way to group multiple resources together:

```yaml
apiVersion: mastra/v1
kind: MastraPod
metadata:
  name: my-application
spec:
  config:
    # Global configuration
  resources:
    # Inline resource definitions
    - apiVersion: mastra/v1
      kind: Agent
      # ...
    
    # External resource files
    - file: ./agents/my-agent.yaml
    
    # Directory of resources
    - directory: ./workflows
```

### Resource Dependencies

When resources depend on each other, apply them in the correct order:

1. Apply Tool resources first
2. Apply Agent resources that use those tools
3. Apply Workflow or Network resources that orchestrate those agents

## Troubleshooting

### Common Issues

1. **Resource Not Found**: Ensure resource exists and namespace is correct
2. **Validation Errors**: Check resource schema against documentation
3. **Runtime Errors**: Check logs with `mastra logs` command

### Getting Help

Run the help command for detailed usage information:

```bash
node mastra-cli-helper.js help
```

## Next Steps

1. Explore the [Mastra CLI Documentation](../../docs/cli/cli-tool.md)
2. Review the [Resource Specifications](../../docs/resources/resource-spec.md)
3. Build your own resources using the examples as templates 