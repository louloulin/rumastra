# Contributing to Mastra Runtimes

Thank you for considering contributing to Mastra Runtimes! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

If you find a bug, please report it by creating an issue in our GitHub repository. When filing a bug report, please include:

- A clear, descriptive title
- A detailed description of the problem
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots or code snippets if applicable
- Environment information (OS, Node.js version, etc.)

### Suggesting Enhancements

We welcome suggestions for enhancements! Please submit them as GitHub issues with:

- A clear, descriptive title
- A detailed description of the proposed enhancement
- Any relevant examples, mockups, or use cases

### Pull Requests

We actively welcome pull requests. Here's how to submit one:

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Add or update tests as necessary
5. Ensure all tests pass
6. Update documentation if needed
7. Submit a pull request

#### Pull Request Guidelines

- Follow the existing code style
- Include tests for new features or bug fixes
- Update documentation for significant changes
- Keep pull requests focused on a single change
- Reference relevant issues in your PR description

## Development Setup

### Prerequisites

- Node.js (v18+)
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/mastra.git
cd mastra

# Install dependencies
pnpm install
```

### Testing

```bash
# Run all tests
pnpm run test:unit

# Run tests in watch mode
pnpm run test:watch
```

### Building

```bash
# Build the package
pnpm run build
```

## Project Structure

- `src/` - Source code
  - `core/` - Core components
    - `agent/` - Agent-related controllers and executors
    - `workflow/` - Workflow-related controllers and executors
    - `network/` - Network-related controllers and executors
    - `eventbus.ts` - Event bus implementation
    - `controller.ts` - Abstract controller implementation
    - `runtime-manager.ts` - Runtime manager implementation
  - `types.ts` - Type definitions
  - `index.ts` - Main entry point
- `test/` - Test files
- `docs/` - Documentation

## Documentation

When contributing new features, please update the relevant documentation:

- Update `README.md` for significant changes
- Add or update API documentation in `docs/api.md`
- Update `runtimes.md` to reflect implementation status

## License

By contributing to Mastra Runtimes, you agree that your contributions will be licensed under the project's [MIT License](LICENSE). 