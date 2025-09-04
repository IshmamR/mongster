# DESIGN: mongster

## Goals

- **Schema-first TypeScript**: Define data models with rich schemas that provide full type inference
- **Type Safety**: Complete type checking from schema definition to query results
- **Fluent Query API**: Chainable, readable query building with strong typing
- **MongoDB Integration**: Built on top of the official MongoDB Node.js driver
- **Performance**: Minimal runtime overhead with compile-time type checking

## Design Philosophy

### Schema-Based Approach
Unlike interface-based ODMs, mongster uses explicit schema definitions that provide:
- Rich type information (required/optional, nullable, defaults)
- Support for complex types (unions, nested documents, arrays)
- Runtime validation capabilities (future)
- Better developer experience with autocomplete and error checking

### Type Inference Engine
The core innovation is a sophisticated type inference system that:
- Converts schema definitions to precise TypeScript types
- Handles complex nested structures and arrays
- Supports union types with proper discriminant handling
- Infers projection results and maintains type safety throughout query chains

### Query Building
- Immutable query builders that return new instances
- Type-safe field access and filtering
- Support for nested path queries using dot notation
- Projection types that accurately reflect the returned data shape

## Core Types

### Schema Definition
```ts
interface FieldDefinition {
  type: FieldType | "Union";
  required?: boolean;
  nullable?: boolean;
  default?: any;
  of?: readonly any[];  // for union types
}
```

### Type Inference
- `InferInputType<Schema>`: Type for creating documents (handles defaults)
- `InferDocumentType<Schema>`: Type for stored documents (includes _id)
- `InferSchemaType<Schema>`: Alias for document type
- Complex recursive inference for nested documents and arrays

### Query System
- `Query<T>`: Chainable query builder with fluent API
- `Filter<T>`: MongoDB-compatible filters with type constraints
- Projection types that maintain type safety for selected fields

## Implementation Details

### Schema Processing
1. Schema definitions are processed at compile time
2. TypeScript's type system infers the exact shape of documents
3. Nested schemas are recursively processed
4. Union types are handled with proper discriminant support

### Query Execution
1. Queries are built as immutable chains
2. Each method returns a new query instance
3. Final `.exec()` or `.findOne()` executes against MongoDB
4. Results are typed based on projections and selections

### Nested Path Support
- Dot notation queries: `"address.city"`, `"user.profile.name"`
- Type-safe nested field access in projections and sorts
- Recursive path generation with depth limits for performance

## Architecture Decisions

### Why Schema-Based vs Interface-Based?
- **Schemas provide runtime information**: Required for validation, defaults, and MongoDB integration
- **Better type inference**: More precise types than generic interfaces
- **Extensibility**: Can add validation, hooks, and other features
- **MongoDB alignment**: Matches MongoDB's document-oriented nature

### Type System Complexity
- Uses advanced TypeScript features (conditional types, mapped types, template literals)
- Balances type safety with compilation performance
- Recursive types have depth limits to prevent infinite recursion

### Runtime vs Compile Time
- Maximum type checking at compile time
- Minimal runtime overhead
- Schema information available for future runtime features (validation, migrations)

## Non-Goals (for now)

- Runtime schema validation (can be added later)
- Heavy plugin architecture like Mongoose
- ORM-style relations and joins
- Migration system (future consideration)
