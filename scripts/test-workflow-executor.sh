#!/bin/bash

# Script to test the WorkflowExecutor

# Navigate to the runtimes directory
cd "$(dirname "$0")/.."

# Run the tests for the workflow executor
npx vitest run test/core/workflow/executor.test.ts 