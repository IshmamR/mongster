# mongster

TypeScript-first, schema-based ODM for MongoDB with strong type inference and automatic index management.

**Status**: Pre-alpha (v0.0.11). Core features implemented, API may evolve.

## Features

- 🎯 **Full Type Safety** – Complete TypeScript inference from schema to query results
- 🔧 **Rich Schema Builder** – Chainable API for defining schemas with validation
- 📇 **Automatic Index Management** – Declare indexes in schema, sync automatically
- 🔍 **Type-Safe Queries** – MongoDB queries with full autocomplete and type checking
- 🎨 **Flexible API** – Use global client or create multiple instances
- ⚡ **Modern Stack** – Built with Bun, works with Node.js

## Install

```bash
bun add mongster
# or
npm install mongster
```

**Requirements**:
- TypeScript ^5
- Node.js >= 18 or Bun >= 1.0

## Quick Start

```ts
import { M, MongsterClient } from 'mongster';

// Create and connect client
const client = new MongsterClient();
await client.connect(process.env.MONGO_URI!, { dbName: "myapp" });

// Define schema with the M schema builder
const userSchema = M.schema({
  name: M.string(),
  email: M.string().uniqueIndex(),
  age: M.number().min(0).max(120),
  isActive: M.boolean().default(true),
  tags: M.array(M.string()),
  profile: M.object({
    bio: M.string().optional(),
    avatar: M.string().optional(),
  }).optional(),
}).withTimestamps(); // adds createdAt, updatedAt

// Create model
const User = client.model("users", userSchema);

// Type-safe operations
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 28,
  tags: ["developer", "designer"],
});

// Queries with full type safety
const users = await User.find({ 
  age: { $gte: 18 },
  isActive: true 
});

// Update operations
await User.updateOne(
  { email: "alice@example.com" },
  { $set: { age: 29 } }
);
```

## Schema Definition

### Schema Builder (`M`)

The `M` schema builder provides a chainable API for defining schemas:

```ts
import { M } from 'mongster';

const schema = M.schema({
  // Primitives
  name: M.string(),
  age: M.number(),
  active: M.boolean(),
  createdAt: M.date(),
  
  // With validation
  email: M.string()
    .min(5)
    .max(100)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  
  score: M.number()
    .min(0)
    .max(100),
  
  status: M.string()
    .enum(["pending", "active", "inactive"]),
  
  // Arrays
  tags: M.array(M.string()),
  matrix: M.array(M.array(M.number())),
  
  // Nested objects
  address: M.object({
    street: M.string(),
    city: M.string(),
    zipCode: M.number(),
  }),
  
  // Optional and nullable
  bio: M.string().optional(),
  middleName: M.string().nullable(),
  nickname: M.string().optional().nullable(),
  
  // Default values
  role: M.string().default("user"),
  createdAt: M.date().defaultFn(() => new Date()),
  
  // BSON types
  userId: M.objectId(),
  price: M.decimal(),
  data: M.binary(),
});
```

### Indexes

Declare indexes directly in your schema:

```ts
const userSchema = M.schema({
  email: M.string().uniqueIndex(),      // unique index
  username: M.string().index(),         // regular index
  lastName: M.string().index(-1),       // descending index
  bio: M.string().textIndex(),          // text index
  tags: M.array(M.string()).hashedIndex(), // hashed index
  
  // Sparse and partial indexes
  phone: M.string().sparseIndex(),
  status: M.string().partialIndex({ status: { $eq: "active" } }),
  
  // TTL index (auto-delete after time)
  expiresAt: M.date().ttl(3600), // 1 hour in seconds
  
  // Compound indexes (at schema level)
}).createIndex(
  { lastName: 1, firstName: 1 },
  { unique: true }
);

// Indexes sync automatically on first operation
// Or manually sync:
await User.syncIndexes();
```

### Timestamps

Add automatic `createdAt` and `updatedAt` fields:

```ts
const schema = M.schema({
  name: M.string(),
}).withTimestamps();

// Results in type:
// { name: string; createdAt: Date; updatedAt: Date; }
```

## Models

### Creating Models

```ts
// Using client instance
const client = new MongsterClient();
const User = client.model("users", userSchema);

// Using global client
import { mongster, model } from 'mongster';
const User = model("users", userSchema);

// Multiple database instances
const client1 = new MongsterClient();
await client1.connect(URI1);
const User1 = client1.model("users", schema);

const client2 = new MongsterClient();
await client2.connect(URI2);
const User2 = client2.model("users", schema);
```

## CRUD Operations

### Create

```ts
// Single document
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  age: 28,
});

// Multiple documents
const users = await User.createMany([
  { name: "Bob", email: "bob@example.com", age: 30 },
  { name: "Charlie", email: "charlie@example.com", age: 25 },
]);

// With custom _id
const user = await User.create({
  _id: new ObjectId(),
  name: "Dave",
  email: "dave@example.com",
});
```

### Read

```ts
// Find multiple
const users = await User.find({ age: { $gte: 18 } });

// Find one
const user = await User.findOne({ email: "alice@example.com" });

// With sorting and pagination
const users = await User.find({})
  .sort({ age: -1 })
  .skip(10)
  .limit(10);

// Count
const count = await User.count({ isActive: true });

// Distinct
const cities = await User.distinct("address.city");
```

### Update

```ts
// Update one
await User.updateOne(
  { email: "alice@example.com" },
  { $set: { age: 29 } }
);

// Update many
await User.updateMany(
  { isActive: false },
  { $set: { status: "archived" } }
);

// With upsert
await User.updateOne(
  { email: "new@example.com" },
  { $set: { name: "New User" } },
  { upsert: true }
);

// Array operations
await User.updateOne(
  { _id: userId },
  { $push: { tags: "new-tag" } }
);

await User.updateOne(
  { _id: userId },
  { $pull: { tags: "old-tag" } }
);
```

### Replace

```ts
// Replace entire document (except _id)
await User.replaceOne(
  { email: "alice@example.com" },
  { name: "Alice Smith", email: "alice@example.com", age: 30 }
);
```

### Delete

```ts
// Delete one
await User.deleteOne({ email: "alice@example.com" });

// Delete many
await User.deleteMany({ isActive: false });

// Delete all
await User.deleteMany({});
```

## Query Building

Type-safe query building with MongoDB operators:

```ts
// Comparison operators
User.find({ age: { $eq: 25 } });
User.find({ age: { $ne: 25 } });
User.find({ age: { $gt: 18 } });
User.find({ age: { $gte: 18 } });
User.find({ age: { $lt: 65 } });
User.find({ age: { $lte: 65 } });
User.find({ age: { $in: [25, 30, 35] } });
User.find({ age: { $nin: [18, 21] } });

// Logical operators
User.find({ 
  $and: [
    { age: { $gte: 18 } },
    { isActive: true }
  ]
});

User.find({
  $or: [
    { role: "admin" },
    { role: "moderator" }
  ]
});

// Nested fields (dot notation)
User.find({ "address.city": "New York" });
User.find({ "profile.bio": { $exists: true } });

// Array queries
User.find({ tags: "developer" }); // contains
User.find({ tags: { $all: ["developer", "designer"] } });
User.find({ tags: { $size: 3 } });
```

## Connection Management

```ts
import { MongsterClient } from 'mongster';

const client = new MongsterClient();

// Connect
await client.connect("mongodb://localhost:27017", {
  dbName: "myapp",
  // Optional: auto-sync indexes on connect
  syncIndexesOnConnect: true,
});

// Get database
const db = client.getDb();

// Disconnect
await client.disconnect();
```

## Type Inference

Mongster provides full type inference:

```ts
import { M } from 'mongster';

const userSchema = M.schema({
  name: M.string(),
  age: M.number().optional(),
  tags: M.array(M.string()),
});

// Infer output type (what you get from DB)
type User = M.infer<typeof userSchema>;
// { name: string; age?: number; tags: string[]; _id: ObjectId }

// Infer input type (what you pass to create)
type UserInput = M.inferInput<typeof userSchema>;
// { name: string; age?: number; tags: string[] }
```

## Validation

Schema validation happens automatically:

```ts
const schema = M.schema({
  age: M.number().min(0).max(120),
  email: M.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  status: M.string().enum(["active", "inactive"]),
});

// ✅ Valid
await Model.create({ age: 25, email: "user@example.com", status: "active" });

// ❌ Throws validation error
await Model.create({ age: 150, email: "invalid", status: "unknown" });
```

## Architecture

```
src/
├── client.ts          # MongsterClient - connection management
├── collection/        # Model implementation & CRUD operations
├── schema/            # Schema builder (M) and type system
│   ├── base.ts        # Base schema classes
│   ├── primitives.ts  # String, Number, Boolean, Date
│   ├── bsons.ts       # ObjectId, Decimal128, Binary
│   ├── composites.ts  # Object, Array, Tuple, Union
│   └── schema.ts      # Root MongsterSchema
├── queries/           # Query builders (find, update, etc.)
├── types/             # TypeScript type utilities
└── error.ts           # Error handling
```

## Development

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

## Examples

See the [`examples/`](./examples) directory for more examples.

## License

MIT © IshmamR

