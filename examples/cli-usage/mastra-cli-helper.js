#!/usr/bin/env node

/**
 * Mastra CLI Helper
 * 
 * A comprehensive tool that demonstrates the full capabilities of Mastra CLI
 * for managing and interacting with Mastra resources.
 * 
 * Features:
 * - Resource management (apply, delete, get)
 * - Execution control (run agent, workflow, network)
 * - Diagnostics (validate, status)
 * - Utilities (export, import)
 * 
 * Usage:
 *   node mastra-cli-helper.js <command> [options]
 * 
 * Commands:
 *   apply <file>              Apply a resource from file
 *   delete <kind> <name>      Delete a resource
 *   get <kind> [name]         Get resource(s) details
 *   run <kind> <name>         Execute a resource (agent, workflow, network)
 *   validate <file>           Validate a resource file
 *   status                    Show runtime status
 *   export <kind> <name>      Export a resource to YAML
 *   import <directory>        Import all resources from a directory
 *   help                      Display this help message
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

// Colors for CLI output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

// Configuration
const resourcesDir = path.join(__dirname, 'resources');
const defaultNamespace = 'demo';

// Helper functions
function printHelp() {
  console.log(`
${colors.cyan}Mastra CLI Helper${colors.reset}
A comprehensive tool that demonstrates the full capabilities of Mastra CLI
for managing and interacting with Mastra resources.

${colors.yellow}Usage:${colors.reset}
  node mastra-cli-helper.js <command> [options]

${colors.yellow}Commands:${colors.reset}
  ${colors.green}apply <file>${colors.reset}              Apply a resource from file
  ${colors.green}delete <kind> <name>${colors.reset}      Delete a resource
  ${colors.green}get <kind> [name]${colors.reset}         Get resource(s) details
  ${colors.green}run <kind> <name>${colors.reset}         Execute a resource (agent, workflow, network)
  ${colors.green}validate <file>${colors.reset}           Validate a resource file
  ${colors.green}status${colors.reset}                    Show runtime status
  ${colors.green}export <kind> <name>${colors.reset}      Export a resource to YAML
  ${colors.green}import <directory>${colors.reset}        Import all resources from a directory
  ${colors.green}help${colors.reset}                      Display this help message

${colors.yellow}Examples:${colors.reset}
  node mastra-cli-helper.js apply resources/weather-agent.yaml
  node mastra-cli-helper.js run workflow weather-workflow --input '{"location":"New York"}'
  node mastra-cli-helper.js get agents
  `);
}

function executeCommand(cmd) {
  try {
    console.log(`${colors.blue}Executing:${colors.reset} ${cmd}`);
    return execSync(cmd, { encoding: 'utf8' });
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message || error}`);
    if (error.stdout) console.log(`${colors.yellow}Output:${colors.reset} ${error.stdout}`);
    if (error.stderr) console.error(`${colors.red}Error output:${colors.reset} ${error.stderr}`);
    process.exit(1);
  }
}

function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`${colors.red}Error:${colors.reset} File not found: ${filePath}`);
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const resource = yaml.parse(content);
    
    // Basic validation
    if (!resource.kind) {
      console.error(`${colors.red}Error:${colors.reset} Missing 'kind' in resource`);
      process.exit(1);
    }
    
    if (!resource.metadata || !resource.metadata.name) {
      console.error(`${colors.red}Error:${colors.reset} Missing 'metadata.name' in resource`);
      process.exit(1);
    }
    
    console.log(`${colors.green}File validated successfully:${colors.reset} ${filePath}`);
    console.log(`${colors.cyan}Resource:${colors.reset} ${resource.kind}/${resource.metadata.name}`);
    return resource;
  } catch (error) {
    console.error(`${colors.red}Error parsing YAML:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

function findResourceFiles(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  const resourceFiles = [];
  
  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    
    if (file.isDirectory()) {
      // Recursively search subdirectories
      resourceFiles.push(...findResourceFiles(fullPath));
    } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
      resourceFiles.push(fullPath);
    }
  }
  
  return resourceFiles;
}

// Command handlers
function handleApply() {
  if (options.length < 1) {
    console.error(`${colors.red}Error:${colors.reset} Missing file path`);
    console.log('Usage: node mastra-cli-helper.js apply <file>');
    process.exit(1);
  }
  
  const filePath = options[0];
  validateFile(filePath);
  
  const result = executeCommand(`mastra apply -f ${filePath}`);
  console.log(`${colors.green}Resource applied successfully${colors.reset}`);
  console.log(result);
}

function handleDelete() {
  if (options.length < 2) {
    console.error(`${colors.red}Error:${colors.reset} Missing kind or name`);
    console.log('Usage: node mastra-cli-helper.js delete <kind> <name>');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options[1];
  const namespace = options.includes('--namespace') ? 
    options[options.indexOf('--namespace') + 1] : 
    defaultNamespace;
  
  const result = executeCommand(`mastra delete ${kind} ${name} --namespace ${namespace}`);
  console.log(`${colors.green}Resource deleted successfully${colors.reset}`);
  console.log(result);
}

function handleGet() {
  if (options.length < 1) {
    console.error(`${colors.red}Error:${colors.reset} Missing kind`);
    console.log('Usage: node mastra-cli-helper.js get <kind> [name]');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options.length > 1 ? options[1] : '';
  const namespace = options.includes('--namespace') ? 
    options[options.indexOf('--namespace') + 1] : 
    defaultNamespace;
  
  const cmd = name ? 
    `mastra get ${kind} ${name} --namespace ${namespace}` : 
    `mastra get ${kind} --namespace ${namespace}`;
  
  const result = executeCommand(cmd);
  console.log(result);
}

function handleRun() {
  if (options.length < 2) {
    console.error(`${colors.red}Error:${colors.reset} Missing kind or name`);
    console.log('Usage: node mastra-cli-helper.js run <kind> <name> [--input <json>]');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options[1];
  const namespace = options.includes('--namespace') ? 
    options[options.indexOf('--namespace') + 1] : 
    defaultNamespace;
  
  // Check for input parameter
  let inputParam = '';
  if (options.includes('--input')) {
    const inputIndex = options.indexOf('--input');
    if (inputIndex + 1 < options.length) {
      inputParam = `--input '${options[inputIndex + 1]}'`;
    }
  }
  
  // Validate kind (agent, workflow, network)
  const validKinds = ['agent', 'workflow', 'network'];
  if (!validKinds.includes(kind.toLowerCase())) {
    console.error(`${colors.red}Error:${colors.reset} Invalid kind: ${kind}`);
    console.log(`Supported kinds: ${validKinds.join(', ')}`);
    process.exit(1);
  }
  
  const result = executeCommand(`mastra run ${kind} ${name} --namespace ${namespace} ${inputParam}`);
  console.log(`${colors.green}Execution result:${colors.reset}`);
  
  try {
    // Try to parse as JSON for nicer display
    const jsonResult = JSON.parse(result);
    console.log(JSON.stringify(jsonResult, null, 2));
  } catch {
    // If not valid JSON, just print as-is
    console.log(result);
  }
}

function handleValidate() {
  if (options.length < 1) {
    console.error(`${colors.red}Error:${colors.reset} Missing file path`);
    console.log('Usage: node mastra-cli-helper.js validate <file>');
    process.exit(1);
  }
  
  const filePath = options[0];
  validateFile(filePath);
  console.log(`${colors.green}Resource validation successful${colors.reset}`);
}

function handleStatus() {
  const result = executeCommand('mastra status');
  console.log(result);
}

function handleExport() {
  if (options.length < 2) {
    console.error(`${colors.red}Error:${colors.reset} Missing kind or name`);
    console.log('Usage: node mastra-cli-helper.js export <kind> <name>');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options[1];
  const namespace = options.includes('--namespace') ? 
    options[options.indexOf('--namespace') + 1] : 
    defaultNamespace;
  
  const outputPath = `${name}-export.yaml`;
  const result = executeCommand(`mastra get ${kind} ${name} --namespace ${namespace} -o yaml > ${outputPath}`);
  
  console.log(`${colors.green}Resource exported successfully to:${colors.reset} ${outputPath}`);
  return outputPath;
}

function handleImport() {
  if (options.length < 1) {
    console.error(`${colors.red}Error:${colors.reset} Missing directory path`);
    console.log('Usage: node mastra-cli-helper.js import <directory>');
    process.exit(1);
  }
  
  const directoryPath = options[0];
  if (!fs.existsSync(directoryPath)) {
    console.error(`${colors.red}Error:${colors.reset} Directory not found: ${directoryPath}`);
    process.exit(1);
  }
  
  const resourceFiles = findResourceFiles(directoryPath);
  if (resourceFiles.length === 0) {
    console.error(`${colors.red}Error:${colors.reset} No YAML files found in directory`);
    process.exit(1);
  }
  
  console.log(`${colors.blue}Found ${resourceFiles.length} resource files to import${colors.reset}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of resourceFiles) {
    try {
      validateFile(file);
      executeCommand(`mastra apply -f ${file}`);
      console.log(`${colors.green}✓ Applied:${colors.reset} ${file}`);
      successCount++;
    } catch (error) {
      console.error(`${colors.red}✗ Failed to apply:${colors.reset} ${file}`);
      console.error(`  ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n${colors.blue}Import summary:${colors.reset}`);
  console.log(`${colors.green}Successfully imported:${colors.reset} ${successCount}`);
  if (failCount > 0) {
    console.log(`${colors.red}Failed imports:${colors.reset} ${failCount}`);
  }
}

// Main command processor
function processCommand() {
  switch (command) {
    case 'apply':
      handleApply();
      break;
    case 'delete':
      handleDelete();
      break;
    case 'get':
      handleGet();
      break;
    case 'run':
      handleRun();
      break;
    case 'validate':
      handleValidate();
      break;
    case 'status':
      handleStatus();
      break;
    case 'export':
      handleExport();
      break;
    case 'import':
      handleImport();
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`${colors.red}Error:${colors.reset} Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

// Execute the requested command
if (!command) {
  printHelp();
} else {
  processCommand();
} 