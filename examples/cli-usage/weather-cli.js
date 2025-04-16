#!/usr/bin/env node

/**
 * Weather CLI Example
 * 
 * This script demonstrates how to use the Mastra CLI to deploy and run
 * the weather workflow resource.
 * 
 * Usage:
 *   node weather-cli.js <location> [--detailed]
 * 
 * Example:
 *   node weather-cli.js "San Francisco" --detailed
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a location');
  console.error('Usage: node weather-cli.js <location> [--detailed]');
  process.exit(1);
}

const location = args[0];
const detailed = args.includes('--detailed');

// Set paths to resource files
const resourcesDir = path.join(__dirname, 'resources');
const agentYamlPath = path.join(resourcesDir, 'weather-agent.yaml');
const workflowYamlPath = path.join(resourcesDir, 'weather-workflow.yaml');

// Check if resource files exist
if (!fs.existsSync(agentYamlPath) || !fs.existsSync(workflowYamlPath)) {
  console.error('Resource files not found. Please ensure the following files exist:');
  console.error(`- ${agentYamlPath}`);
  console.error(`- ${workflowYamlPath}`);
  process.exit(1);
}

console.log(`📍 Getting weather information for: ${location}`);
if (detailed) {
  console.log('🔍 Including detailed weather information');
}

try {
  // Deploy the resources using the Mastra CLI
  console.log('\n🚀 Deploying resources...');
  execSync(`mastra apply -f ${agentYamlPath}`, { stdio: 'inherit' });
  execSync(`mastra apply -f ${workflowYamlPath}`, { stdio: 'inherit' });
  
  // Run the workflow with the provided input
  console.log('\n⚙️ Running weather workflow...');
  const input = JSON.stringify({
    location: location,
    additionalInfo: detailed
  });
  
  const result = execSync(
    `mastra run workflow weather-workflow --namespace demo --input '${input}'`,
    { encoding: 'utf8' }
  );
  
  // Parse and display the result
  const weatherData = JSON.parse(result);
  console.log('\n🌤️ Weather Report:');
  console.log('==================');
  console.log(`Location: ${location}`);
  console.log(`Query Time: ${weatherData.queryTime}`);
  console.log('\nWeather Information:');
  console.log(weatherData.weatherInfo);
  
} catch (error) {
  console.error('\n❌ Error occurred:');
  console.error(error.message || error);
  process.exit(1);
} 