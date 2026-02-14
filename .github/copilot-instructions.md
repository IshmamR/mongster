# Copilot Instructions - Mongster

## Project

A type-safe MongoDB ODM (Object Document Mapper) for TypeScript with schema validation, automatic index management, and intuitive query building.

## Code Style

### TypeScript

- Always TS, never `.js` files
- Strict typing, explicit exports
- Type imports: `import type { T } from "./types"`
- Always try to avoid 'any' types

### Naming

- **Files**: `camelCase`
- **Variables/Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Classes**: `PascalCase`

## Don'ts

- No `any` type - use specific types
- No `var` - use `const`/`let`
- No mixed import styles
- No ignoring TS errors
- No God functions - keep focused/small
- No skipping async error handling
- Avoid using single quotes - use double `"`

### Do(s)

- Be concise. Sacrifice grammar for the sake of concision

## Performance

- Choose the option that gives the end user the best performance on DB queries