/**
 * Simple demonstration of the new MastraPod API
 * 
 * This example shows how to use the new simplified API to load and run
 * agents and workflows defined in a MastraPod YAML file.
 */

import { join } from 'path';
import { MastraPod, loadFile, run } from '@mastra/runtimes';

// Path to the YAML file
const yamlPath = join(process.cwd(), 'mastrapod.yaml');

// Example 1: Using loadFile convenience function
async function example1() {
  console.log('\n=== Example 1: Using loadFile ===');
  try {
    // Load the MastraPod from a YAML file
    const pod = await loadFile(yamlPath);
    
    // Get information about available resources
    const agents = pod.getAgents();
    const workflows = pod.getWorkflows();
    const tools = pod.getTools();
    
    console.log(`Loaded pod with:`);
    console.log(`- ${agents.length} agents`);
    console.log(`- ${workflows.length} workflows`);
    console.log(`- ${tools.length} tools`);
    
    // Run the math agent
    if (agents.some(a => a.metadata.name === 'math-agent')) {
      const result = await pod.runAgent('math-agent', '2 + 2 = ?');
      console.log('\nMath agent response:');
      console.log(result.result.content);
    } else {
      console.log('\nMath agent not found');
    }
    
    // Run the math workflow
    if (workflows.some(w => w.metadata.name === 'math-workflow')) {
      const result = await pod.runWorkflow('math-workflow', { problem: 'What is 3 squared?' });
      console.log('\nMath workflow response:');
      console.log(result.result);
    } else {
      console.log('\nMath workflow not found');
    }
    
  } catch (error) {
    console.error('Error in example 1:', error.message);
  }
}

// Example 2: Using the MastraPod class directly
async function example2() {
  console.log('\n=== Example 2: Using MastraPod class ===');
  try {
    // Create a MastraPod instance
    const pod = new MastraPod();
    
    // Add a file
    await pod.addFile(yamlPath);
    
    // Get a specific agent
    const agent = pod.getResource('Agent', 'math-agent');
    if (agent) {
      console.log(`Found agent: ${agent.metadata.name}`);
      console.log(`Instructions: ${agent.spec.instructions}`);
      
      // Call the agent
      const response = await pod.runAgent('math-agent', 'What is the square root of 16?');
      console.log('\nAgent response:');
      console.log(response.result.content);
    } else {
      console.log('Math agent not found');
    }
    
  } catch (error) {
    console.error('Error in example 2:', error.message);
  }
}

// Example 3: Using the run convenience function
async function example3() {
  console.log('\n=== Example 3: Using run convenience function ===');
  try {
    // Run a workflow directly
    const response = await run({
      file: yamlPath,
      workflow: 'math-workflow',
      input: { problem: 'What is 7 * 8?' }
    });
    
    console.log('Workflow response:');
    console.log(response.result);
    
  } catch (error) {
    console.error('Error in example 3:', error.message);
  }
}

// Example 4: Tool usage
async function example4() {
  console.log('\n=== Example 4: Tool usage ===');
  try {
    const pod = await loadFile(yamlPath);
    
    // Call the calculator tool directly
    const response = await pod.callTool('calculator-tool', {
      expression: '3 * (4 + 5)'
    });
    
    console.log('Calculator result:');
    console.log(response.result);
    
  } catch (error) {
    console.error('Error in example 4:', error.message);
  }
}

// Run all examples
async function main() {
  console.log('=== MastraPod API Demonstration ===');
  console.log('File path:', yamlPath);
  
  await example1();
  await example2();
  await example3();
  await example4();
  
  console.log('\nDemonstration completed!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 