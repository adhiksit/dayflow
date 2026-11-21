# Contributing to dayflow

Thank you for your interest in contributing to dayflow!

## Getting Started

1. Fork and clone the repository
2. Run `npm install` to install dependencies
3. Run `npm test` to verify the test suite passes
4. Create a feature branch from `main`

## Development Workflow

```bash
npm run build         # Build ESM + CJS bundles with tsup
npm test              # Run the vitest test suite
npm run test:coverage # Run tests with coverage report
npm run lint          # Check code with ESLint
npm run format        # Format code with Prettier
npm run typecheck     # Run TypeScript type checking
```

## Code Style

- TypeScript strict mode is enabled
- Use Prettier for formatting (runs automatically via `npm run format`)
- Follow existing patterns in the codebase
- Add tests for new features and bug fixes

## Pull Request Guidelines

1. Keep PRs focused on a single change
2. Include tests for new functionality
3. Update CHANGELOG.md under an `[Unreleased]` section
4. Make sure `npm run lint`, `npm run typecheck`, and `npm test` all pass
5. Write a clear PR description explaining what and why

## Reporting Bugs

Open an issue with:
- Steps to reproduce the problem
- Expected vs actual behavior
- Node.js version and operating system
- Relevant data or configuration (scrubbed of private info)

## Feature Requests

Open an issue describing:
- The use case or problem you are trying to solve
- Your proposed solution or API surface
- Any alternatives you considered
