# Contributing to mongster

Thanks for your interest! The project is in active development with core features implemented.

## Development Setup

- **Runtime**: Use Bun for development: `bun install`
- **Type Checking**: `bun run typecheck` 
- **Building**: `bun run build` (outputs to `dist/`)
- **Testing**: Run examples in `test-examples/` to verify functionality

## Code Style & Guidelines

- Follow TypeScript strict mode (`tsconfig.json`)
- Maintain the schema-first, type-safe approach
- Prefer compile-time type checking over runtime validation
- Keep the query API chainable and fluent
- Add comprehensive type tests for new features

## Project Structure

```
src/
├── schema/           # Schema definition and type inference engine
│   └── index.ts      # Core schema types and inference logic
├── model/            # Model creation and management
│   └── index.ts      # createModel function and Model interface
├── queries/          # Query building and execution
│   ├── find/         # Find query chain (sort, project, limit, etc.)
│   └── findOne/      # Single document queries
├── connection/       # MongoDB connection handling
│   └── index.ts      # createConnection and connection management
├── common/           # Shared utilities and type helpers
│   ├── types.ts      # Common type definitions
│   ├── record.ts     # Record/object type utilities
│   ├── string.ts     # String type utilities
│   └── number.ts     # Number type utilities
└── index.ts          # Main exports
```

## Key Areas

### Schema System (`src/schema/`)
- **Type Inference**: Complex recursive types that convert schemas to TypeScript types
- **Field Definitions**: Support for primitives, arrays, nested docs, unions
- **Performance**: Balance type safety with compilation speed

### Query System (`src/queries/`)
- **Chainable API**: Immutable query builders with fluent interface
- **Type Safety**: All operations type-checked against schema
- **MongoDB Integration**: Maps to official driver methods

### Type System (`src/common/`)
- **Utility Types**: Helper types for complex type transformations
- **Nested Paths**: Dot-notation path generation for deep queries
- **Performance**: Manage TypeScript compilation complexity

## Contributing Guidelines

### Adding New Features
1. Start with type definitions in appropriate `src/` subdirectory
2. Implement runtime functionality
3. Add comprehensive examples to `test-examples/`
4. Ensure `bun run typecheck` passes
5. Update documentation

### Type System Changes
- Be mindful of TypeScript compilation performance
- Add depth limits to recursive types when needed
- Test edge cases with complex nested structures
- Consider impact on intellisense and error messages

### Query Features
- Maintain chainable API consistency
- Ensure type safety throughout the chain
- Test with various schema configurations
- Consider MongoDB driver compatibility

## Testing

Currently using example-based testing in `test-examples/`:
- `test-examples/basic.ts` - comprehensive feature testing
- Run examples to verify functionality
- Add new examples for new features

Future: Will migrate to proper test framework with unit tests.

## Pull Request Process

1. **Small, focused PRs** - One feature or fix per PR
2. **Type safety first** - Ensure all changes maintain type safety
3. **Documentation** - Update relevant docs (README, DESIGN, etc.)
4. **Examples** - Add or update examples demonstrating the feature
5. **No breaking changes** - API is still evolving but avoid unnecessary breaks

## Commit Messages

Use clear, imperative messages following conventional commits:
- `feat(schema): add union type support`
- `fix(queries): resolve nested path projection types`
- `docs(readme): update schema examples`
- `refactor(types): simplify nested path generation`

## Release Process

1. Update version in `package.json`
2. Update ROADMAP.md with completed features
3. Ensure all examples work: `bun run typecheck`
4. Build: `bun run prepublishOnly`
5. Publish: `npm publish --access public`

## Areas for Contribution

- **Query Features**: Additional MongoDB operators and query methods
- **Type System**: Improved inference for edge cases
- **Documentation**: Better examples and guides  
- **Performance**: Optimization of type inference
- **Testing**: Proper test suite with comprehensive coverage
