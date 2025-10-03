# Contributing to ACM Node.js Framework

Thank you for your interest in contributing to the ACM Node.js Framework! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Package Guidelines](#package-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/acm.git
   cd acm/framework/node
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Build all packages:
   ```bash
   pnpm build
   ```

5. Create a branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @acm/sdk build

# Watch mode for development
pnpm dev
```

### Running the Demo

```bash
# Run the CLI demo
pnpm --filter @acm/examples demo -- --help

# Example: Run refund workflow
pnpm --filter @acm/examples demo -- --provider ollama --model llama3.1 --goal refund
```

### Cleaning

```bash
# Clean all build artifacts
pnpm clean
```

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Provide type annotations for public APIs
- Document complex types with comments

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multi-line structures
- Maximum line length: 100 characters
- Use meaningful variable and function names

### Example

```typescript
import type { Goal, Context } from '@acm/sdk';

export class MyTask extends Task<MyInput, MyOutput> {
  constructor() {
    super('my-task', 'my-capability');
  }

  async execute(ctx: RunContext, input: MyInput): Promise<MyOutput> {
    // Implementation
    return { data: 'result' };
  }
}
```

### Naming Conventions

- **Classes**: PascalCase (e.g., `LLMPlanner`, `SimpleToolRegistry`)
- **Functions/Methods**: camelCase (e.g., `executePlan`, `evaluateGuard`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Files**: kebab-case (e.g., `memory-ledger.ts`)
- **Packages**: kebab-case with acm prefix (e.g., `@acm/sdk`)

## Testing

### Running Tests

```bash
# Run all tests (when available)
pnpm test

# Test specific package
pnpm --filter @acm/runtime test
```

### Writing Tests

- Place test files next to source files with `.test.ts` extension
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (LLM calls, network, etc.)

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'; // or your test framework

describe('MyTask', () => {
  it('should execute successfully', async () => {
    // Arrange
    const task = new MyTask();
    const ctx = createMockContext();
    
    // Act
    const result = await task.execute(ctx, { input: 'test' });
    
    // Assert
    expect(result.data).toBeDefined();
  });
});
```

## Pull Request Process

### Before Submitting

1. **Build successfully**: Run `pnpm build` with no errors
2. **Follow code standards**: Review your code against the style guide
3. **Update documentation**: If you changed APIs, update relevant docs
4. **Test thoroughly**: Verify your changes work as expected
5. **Clean commits**: Use clear, descriptive commit messages

### Commit Messages

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

Examples:
```
feat(runtime): add support for task timeouts

Implements configurable timeouts per task with automatic
cancellation after the specified duration.

Closes #123
```

```
fix(planner): handle malformed LLM responses gracefully

Falls back to safe linear plan when JSON parsing fails.
```

### PR Description Template

```markdown
## Description
Brief description of your changes

## Motivation
Why are these changes needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How did you test these changes?

## Checklist
- [ ] Code builds without errors
- [ ] Documentation updated
- [ ] Examples updated (if applicable)
- [ ] Follows code standards
- [ ] Commits follow conventional format
```

### Review Process

1. Submit your PR with a clear description
2. Automated checks will run
3. Maintainers will review your code
4. Address any feedback
5. Once approved, your PR will be merged

## Package Guidelines

### Creating a New Package

1. Create package directory:
   ```bash
   mkdir -p packages/acm-newpackage/src
   ```

2. Add `package.json`:
   ```json
   {
     "name": "@acm/newpackage",
     "version": "0.1.0",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "clean": "rm -rf dist"
     }
   }
   ```

3. Add `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "rootDir": "./src",
       "outDir": "./dist"
     },
     "include": ["src/**/*"],
     "references": [
       { "path": "../acm-sdk" }
     ]
   }
   ```

4. Create `src/index.ts` with exports

### Package Dependencies

- **Minimize external dependencies**: Only add truly necessary packages
- **Use workspace protocol**: Reference internal packages with `workspace:*`
- **Document why**: If adding a dependency, explain in PR why it's needed

### Package README

Each package should have its own README with:
- Purpose and scope
- Installation instructions
- Basic usage examples
- API reference
- Examples

## Architecture Decisions

### When to Create a New Package

Create a new package when:
- It represents a distinct concern (e.g., LLM client, runtime, adapters)
- It could be used independently
- It has different dependencies than other packages
- It follows ACM spec boundaries

### Code Organization

- **Keep it simple**: Prefer simple, clear code over clever solutions
- **Single Responsibility**: Each module/class should have one clear purpose
- **Loose Coupling**: Minimize dependencies between modules
- **High Cohesion**: Related functionality stays together

### ACM Spec Compliance

When implementing features:
1. Reference the ACM v0.5 specification
2. Document how your implementation maps to spec requirements
3. Maintain backward compatibility when possible
4. Discuss breaking changes with maintainers

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Tag maintainers for urgent matters

## Recognition

Contributors will be recognized in release notes and documentation. Thank you for making ACM better!
