# mongster

TypeScript‑first, schema-based ODM for MongoDB with strong type inference and chainable query building.

Status: pre‑alpha (v0.0.1). Core features implemented, API may evolve.

## Install

```bash
bun add mongster
```

Peer requirements:
- TypeScript ^5
- Bun >= 1.0 (for dev/build)

## Quick start

```ts
import { Decimal128 } from "bson";
import { createSchema, createConnection, createModel } from 'mongster';

// Create connection
await createConnection(process.env.MONGO_URI!, {
  dbName: "mydb"
});

// Define schema with rich type system
const userSchema = createSchema({
  name: { type: String, required: true },
  email: String, // shorthand syntax
  age: Number,
  isActive: { type: Boolean, default: true, nullable: true },
  tags: [String], // array of strings
  metadata: { type: Decimal128, required: false },
  // Union types
  status: { type: "Union", of: ["active", "inactive", "pending"] as const },
  // Nested documents
  address: { 
    type: createSchema({
      street: String,
      city: { type: String, required: true },
      zipCode: Number
    }),
    nullable: true 
  }
});

// Create model with full type inference
const UserModel = createModel("users", userSchema);

// Chainable queries with type safety
const users = await UserModel
  .find({ 
    age: { $gte: 18 },
    "address.city": "New York" // nested path queries
  })
  .sort({ age: -1 })
  .limit(10)
  .project({ name: 1, email: 1, "address.city": 1 })
  .exec();

// Result is fully typed based on projection
users[0].name; // ✓ string
users[0].age;  // ✗ Type error - not projected
```

## Features

### Schema Definition
- **Rich Type System**: Support for primitives, arrays, nested documents, and union types
- **Type Inference**: Full TypeScript type inference from schema to query results
- **Flexible Syntax**: Both shorthand (`String`) and detailed (`{ type: String, required: true }`) syntax
- **Nested Documents**: Deep nesting with subdocument arrays and complex structures
- **Union Types**: Type-safe union fields with proper discriminant checking

### Query Building
- **Chainable API**: Fluent interface for building complex queries
- **Type Safety**: All query operations are type-checked against the schema
- **Nested Path Queries**: Support for dot-notation like `"address.city"`
- **Projection Support**: Type-safe field selection with nested path support
- **Sorting**: Multi-field sorting with nested path support

### Currently Supported
- `createConnection(uri, options)` – MongoDB connection management
- `createSchema(definition)` – Schema definition with type inference
- `createModel(name, schema)` – Model creation with full typing
- **Query Methods**:
  - `.find(filter)` / `.findOne(filter)` – Document retrieval
  - `.sort({ field: 1 | -1 })` – Sorting with nested paths
  - `.project({ field: 1 | 0 })` – Field projection
  - `.limit(n)` / `.skip(n)` – Pagination
  - `.exec()` – Query execution

## Schema Types

### Primitive Types
```ts
{
  name: String,
  age: Number,
  active: Boolean,
  createdAt: Date,
  price: Decimal128
}
```

### Array Types
```ts
{
  tags: [String],              // string[]
  matrix: [[Number]],          // number[][]
  scores: { type: [Number], required: true }
}
```

### Nested Documents
```ts
const addressSchema = createSchema({
  street: String,
  city: { type: String, required: true }
});

const userSchema = createSchema({
  address: addressSchema,
  addresses: [addressSchema]  // array of subdocuments
});
```

### Union Types
```ts
{
  status: { 
    type: "Union", 
    of: ["pending", "approved", "rejected"] as const 
  },
  value: {
    type: "Union",
    of: [String, Number] as const,
    nullable: true
  }
}
```

### Field Options
```ts
{
  email: { 
    type: String, 
    required: true,     // makes field non-optional
    nullable: false,    // disallows null values
    default: "guest"    // default value (affects input type)
  }
}
```

## Development

```bash
bun install
bun run typecheck
bun run build
```

Build outputs ESM and CJS to `dist/` with type declarations.

## Architecture

- `src/schema/` – Schema definition and type inference
- `src/model/` – Model creation and management  
- `src/queries/` – Query building and execution
- `src/connection/` – MongoDB connection handling
- `src/common/` – Shared utilities and types

## License

MIT © IshmamR
