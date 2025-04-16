#!/usr/bin/env node

/**
 * CLI Wrapper Generator
 * 
 * This script helps you create a customized CLI wrapper for Mastra based on your project requirements.
 * It generates a Node.js script that you can use to interact with Mastra resources through CLI commands.
 * 
 * Usage:
 *   node create-cli-wrapper.js [output-file]
 * 
 * Example:
 *   node create-cli-wrapper.js my-mastra-cli.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default output file
const outputFile = process.argv[2] || 'custom-mastra-cli.js';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// CLI configuration options
const cliConfig = {
  projectName: '',
  commands: [],
  resources: {
    agents: false,
    workflows: false,
    networks: false,
    tools: false
  },
  features: {
    resourceManagement: false,
    execution: false,
    diagnostics: false,
    utilities: false
  },
  outputFormat: 'table',
  defaultNamespace: 'default'
};

// Template for CLI wrapper
const cliTemplate = `#!/usr/bin/env node

/**
 * {{projectName}} CLI
 * 
 * A customized CLI wrapper for Mastra resources.
 * 
 * Usage:
 *   node {{filename}} <command> [options]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  defaultNamespace: '{{defaultNamespace}}',
  outputFormat: '{{outputFormat}}',
  resourcesDir: path.join(__dirname, 'resources')
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

// Helper functions
function printHelp() {
  console.log(\`
{{projectName}} CLI - Mastra Resource Manager

Usage:
  node {{filename}} <command> [options]

Commands:{{commandList}}

Options:
  --namespace, -n <namespace>  Specify namespace (default: {{defaultNamespace}})
  --help, -h                   Show help information
\`);
}

function executeCommand(cmd) {
  try {
    console.log(\`Executing: \${cmd}\`);
    return execSync(cmd, { encoding: 'utf8' });
  } catch (error) {
    console.error(\`Error: \${error.message || error}\`);
    process.exit(1);
  }
}

// Command handlers{{commandHandlers}}

// Main command processor
function processCommand() {
  switch (command) {{{commandProcessors}}
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(\`Error: Unknown command: \${command}\`);
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
`;

// Command templates
const commandTemplates = {
  apply: {
    description: '  apply <file>               Apply a resource from file',
    handler: `
function handleApply() {
  if (options.length < 1) {
    console.error('Error: Missing file path');
    console.log('Usage: node {{filename}} apply <file>');
    process.exit(1);
  }
  
  const filePath = options[0];
  if (!fs.existsSync(filePath)) {
    console.error(\`Error: File not found: \${filePath}\`);
    process.exit(1);
  }
  
  const result = executeCommand(\`mastra apply -f \${filePath}\`);
  console.log('Resource applied successfully');
  console.log(result);
}`,
    processor: `
    case 'apply':
      handleApply();
      break;`
  },
  delete: {
    description: '  delete <kind> <name>       Delete a resource',
    handler: `
function handleDelete() {
  if (options.length < 2) {
    console.error('Error: Missing kind or name');
    console.log('Usage: node {{filename}} delete <kind> <name>');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options[1];
  const namespace = options.includes('--namespace') || options.includes('-n') ? 
    options[options.indexOf('--namespace') + 1 || options.indexOf('-n') + 1] : 
    config.defaultNamespace;
  
  const result = executeCommand(\`mastra delete \${kind} \${name} --namespace \${namespace}\`);
  console.log('Resource deleted successfully');
  console.log(result);
}`,
    processor: `
    case 'delete':
      handleDelete();
      break;`
  },
  get: {
    description: '  get <kind> [name]          Get resource(s) details',
    handler: `
function handleGet() {
  if (options.length < 1) {
    console.error('Error: Missing kind');
    console.log('Usage: node {{filename}} get <kind> [name]');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options.length > 1 && !options[1].startsWith('-') ? options[1] : '';
  const namespace = options.includes('--namespace') || options.includes('-n') ? 
    options[options.indexOf('--namespace') + 1 || options.indexOf('-n') + 1] : 
    config.defaultNamespace;
  
  const outputFormat = options.includes('--output') || options.includes('-o') ? 
    options[options.indexOf('--output') + 1 || options.indexOf('-o') + 1] : 
    config.outputFormat;
  
  const cmd = name ? 
    \`mastra get \${kind} \${name} --namespace \${namespace} -o \${outputFormat}\` : 
    \`mastra get \${kind} --namespace \${namespace} -o \${outputFormat}\`;
  
  const result = executeCommand(cmd);
  console.log(result);
}`,
    processor: `
    case 'get':
      handleGet();
      break;`
  },
  run: {
    description: '  run <kind> <name>          Execute a resource (agent, workflow, network)',
    handler: `
function handleRun() {
  if (options.length < 2) {
    console.error('Error: Missing kind or name');
    console.log('Usage: node {{filename}} run <kind> <name> [--input <json>]');
    process.exit(1);
  }
  
  const kind = options[0];
  const name = options[1];
  const namespace = options.includes('--namespace') || options.includes('-n') ? 
    options[options.indexOf('--namespace') + 1 || options.indexOf('-n') + 1] : 
    config.defaultNamespace;
  
  // Check for input parameter
  let inputParam = '';
  if (options.includes('--input')) {
    const inputIndex = options.indexOf('--input');
    if (inputIndex + 1 < options.length) {
      inputParam = \`--input '\${options[inputIndex + 1]}'\`;
    }
  }
  
  // Validate kind (agent, workflow, network)
  const validKinds = ['agent', 'workflow', 'network'];
  if (!validKinds.includes(kind.toLowerCase())) {
    console.error(\`Error: Invalid kind: \${kind}\`);
    console.log(\`Supported kinds: \${validKinds.join(', ')}\`);
    process.exit(1);
  }
  
  const result = executeCommand(\`mastra run \${kind} \${name} --namespace \${namespace} \${inputParam}\`);
  console.log('Execution result:');
  
  try {
    // Try to parse as JSON for nicer display
    const jsonResult = JSON.parse(result);
    console.log(JSON.stringify(jsonResult, null, 2));
  } catch {
    // If not valid JSON, just print as-is
    console.log(result);
  }
}`,
    processor: `
    case 'run':
      handleRun();
      break;`
  },
  validate: {
    description: '  validate <file>            Validate a resource file',
    handler: `
function handleValidate() {
  if (options.length < 1) {
    console.error('Error: Missing file path');
    console.log('Usage: node {{filename}} validate <file>');
    process.exit(1);
  }
  
  const filePath = options[0];
  if (!fs.existsSync(filePath)) {
    console.error(\`Error: File not found: \${filePath}\`);
    process.exit(1);
  }
  
  try {
    // Basic validation: check if file is valid YAML
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Validate with Mastra CLI
    executeCommand(\`mastra validate -f \${filePath}\`);
    console.log('Resource validation successful');
  } catch (error) {
    console.error(\`Error validating resource: \${error.message}\`);
    process.exit(1);
  }
}`,
    processor: `
    case 'validate':
      handleValidate();
      break;`
  },
  status: {
    description: '  status                      Show runtime status',
    handler: `
function handleStatus() {
  const result = executeCommand('mastra status');
  console.log(result);
}`,
    processor: `
    case 'status':
      handleStatus();
      break;`
  },
  import: {
    description: '  import <directory>          Import all resources from a directory',
    handler: `
function handleImport() {
  if (options.length < 1) {
    console.error('Error: Missing directory path');
    console.log('Usage: node {{filename}} import <directory>');
    process.exit(1);
  }
  
  const directoryPath = options[0];
  if (!fs.existsSync(directoryPath)) {
    console.error(\`Error: Directory not found: \${directoryPath}\`);
    process.exit(1);
  }
  
  // Find all YAML files in the directory
  function findYamlFiles(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    const yamlFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        if (options.includes('--recursive') || options.includes('-r')) {
          yamlFiles.push(...findYamlFiles(fullPath));
        }
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        yamlFiles.push(fullPath);
      }
    }
    
    return yamlFiles;
  }
  
  const yamlFiles = findYamlFiles(directoryPath);
  
  if (yamlFiles.length === 0) {
    console.error('Error: No YAML files found in directory');
    process.exit(1);
  }
  
  console.log(\`Found \${yamlFiles.length} resource files to import\`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of yamlFiles) {
    try {
      executeCommand(\`mastra apply -f \${file}\`);
      console.log(\`✓ Applied: \${file}\`);
      successCount++;
    } catch (error) {
      console.error(\`✗ Failed to apply: \${file}\`);
      console.error(\`  \${error.message}\`);
      failCount++;
    }
  }
  
  console.log(\`\\nImport summary:\`);
  console.log(\`Successfully imported: \${successCount}\`);
  if (failCount > 0) {
    console.log(\`Failed imports: \${failCount}\`);
  }
}`,
    processor: `
    case 'import':
      handleImport();
      break;`
  }
};

// Function to ask question and get answer
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to ask yes/no question
async function askYesNo(question) {
  const answer = await askQuestion(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// Function to get CLI configuration from user
async function getCLIConfig() {
  console.log('========================================================');
  console.log('         Mastra CLI Wrapper Generator Wizard            ');
  console.log('========================================================');
  console.log('This wizard will help you create a customized CLI wrapper');
  console.log('for Mastra based on your project requirements.');
  console.log('--------------------------------------------------------\n');
  
  // Project name
  cliConfig.projectName = await askQuestion('Enter your project name: ');
  
  // Resource types to support
  console.log('\nWhich resource types do you want to support?');
  cliConfig.resources.agents = await askYesNo('- Agents');
  cliConfig.resources.workflows = await askYesNo('- Workflows');
  cliConfig.resources.networks = await askYesNo('- Networks');
  cliConfig.resources.tools = await askYesNo('- Tools');
  
  // Features to include
  console.log('\nWhich features do you want to include?');
  cliConfig.features.resourceManagement = await askYesNo('- Resource management (apply, delete, get)');
  cliConfig.features.execution = await askYesNo('- Resource execution (run)');
  cliConfig.features.diagnostics = await askYesNo('- Diagnostics (validate, status)');
  cliConfig.features.utilities = await askYesNo('- Utilities (import)');
  
  // Default namespace
  const defaultNamespace = await askQuestion('\nEnter default namespace (default: default): ');
  cliConfig.defaultNamespace = defaultNamespace || 'default';
  
  // Output format
  console.log('\nPreferred output format:');
  console.log('1. Table (human-readable)');
  console.log('2. JSON (machine-readable)');
  console.log('3. YAML (configuration-friendly)');
  const formatChoice = await askQuestion('Select format (1/2/3): ');
  
  switch (formatChoice) {
    case '2':
      cliConfig.outputFormat = 'json';
      break;
    case '3':
      cliConfig.outputFormat = 'yaml';
      break;
    default:
      cliConfig.outputFormat = 'table';
  }
  
  // Determine commands to include
  if (cliConfig.features.resourceManagement) {
    cliConfig.commands.push('apply', 'delete', 'get');
  }
  
  if (cliConfig.features.execution) {
    cliConfig.commands.push('run');
  }
  
  if (cliConfig.features.diagnostics) {
    cliConfig.commands.push('validate', 'status');
  }
  
  if (cliConfig.features.utilities) {
    cliConfig.commands.push('import');
  }
  
  console.log('\nCLI Wrapper Configuration:');
  console.log(`- Project name: ${cliConfig.projectName}`);
  console.log(`- Resources: ${Object.entries(cliConfig.resources)
    .filter(([_, value]) => value)
    .map(([key]) => key)
    .join(', ')}`);
  console.log(`- Commands: ${cliConfig.commands.join(', ')}`);
  console.log(`- Default namespace: ${cliConfig.defaultNamespace}`);
  console.log(`- Output format: ${cliConfig.outputFormat}`);
  
  const confirm = await askYesNo('\nDo you want to generate the CLI wrapper with these settings?');
  if (!confirm) {
    console.log('CLI wrapper generation cancelled.');
    process.exit(0);
  }
}

// Function to generate CLI wrapper code
function generateCLIWrapper() {
  let commandList = '';
  let commandHandlers = '';
  let commandProcessors = '';
  
  // Add commands
  cliConfig.commands.forEach(cmd => {
    const template = commandTemplates[cmd];
    if (template) {
      commandList += `\n${template.description}`;
      commandHandlers += template.handler;
      commandProcessors += template.processor;
    }
  });
  
  // Replace placeholders in template
  let cliCode = cliTemplate
    .replace(/{{projectName}}/g, cliConfig.projectName)
    .replace(/{{filename}}/g, path.basename(outputFile))
    .replace(/{{defaultNamespace}}/g, cliConfig.defaultNamespace)
    .replace(/{{outputFormat}}/g, cliConfig.outputFormat)
    .replace(/{{commandList}}/g, commandList)
    .replace(/{{commandHandlers}}/g, commandHandlers)
    .replace(/{{commandProcessors}}/g, commandProcessors);
  
  // Write to file
  fs.writeFileSync(outputFile, cliCode);
  
  console.log(`\nCLI wrapper generated successfully: ${outputFile}`);
  console.log('Make it executable with: chmod +x ' + outputFile);
  console.log('You can now use your CLI wrapper: node ' + outputFile + ' <command> [options]');
}

// Main function
async function main() {
  try {
    await getCLIConfig();
    generateCLIWrapper();
  } catch (error) {
    console.error('Error generating CLI wrapper:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run main function
main(); 