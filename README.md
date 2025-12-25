# Mongster

A type-safe MongoDB ODM (Object Document Mapper) for TypeScript with schema validation, automatic index management, and intuitive query building.

## Features

- 🔒 **Fully Type-Safe** - End-to-end TypeScript support with complete type inference
- 📝 **Schema Validation** - Runtime validation with automatic TypeScript type generation
- 🔍 **Index Management** - Automatic index synchronization with MongoDB
- 🎯 **Query Builder** - Fluent, type-safe query API with projection and filtering
- 🔄 **Transactions** - ACID transactions with automatic session management
- ⚡ **Optimized Performance** - Built with Bun, compatible with Node.js 18+
- 🕒 **Timestamps** - Automatic `createdAt` and `updatedAt` field management
- 🛡️ **Error Handling** - Comprehensive error types for better debugging

## Installation

```bash
npm install mongster
# or
bun add mongster
# or
yarn add mongster
# or
pnpm add mongster
```

## Quick Start

```typescript
import { M, mongster, model } from "mongster";

// Define your schema
const userSchema = M.schema({
  name: M.string(),
  email: M.string(),
  age: M.number().min(0).max(120),
  address: M.object({
    street: M.string(),
    city: M.string(),
    zip: M.number()
  }).optional(),
  tags: M.array(M.string()).optional()
}).withTimestamps();

// Create a model
const User = model("users", userSchema);

// Connect to MongoDB
await mongster.connect("mongodb://localhost:27017/mydb");

// Create documents
const user = await User.createOne({
  name: "John Doe",
  email: "john@example.com",
  age: 30
});

// Query documents
const users = await User.find({ age: { $gte: 18 } })
  .include(["name", "email"])
  .limit(10);
```

## Schema Definition

### Basic Types

```typescript
import { M } from "mongster";

const schema = M.schema({
  // Primitives
  name: M.string(),
  age: M.number(),
  active: M.boolean(),
  birthDate: M.date(),
  
  // MongoDB Types
  userId: M.objectId(),
  data: M.binary(),
  price: M.decimal128(),
  
  // Optional fields
  nickname: M.string().optional(),
  
  // Default values
  status: M.string().default("pending"),
  createdAt: M.date().defaultFn(() => new Date()),
});
```

### Validation

```typescript
const schema = M.schema({
  // String validation
  username: M.string().min(3).max(20),
  email: M.string().match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/),
  role: M.string().enum(["admin", "user", "guest"]),
  
  // Number validation
  age: M.number().min(0).max(120),
  score: M.number().enum([1, 2, 3, 4, 5]),
  
  // Boolean
  verified: M.boolean(),
});
```

### Nested Objects and Arrays

```typescript
const schema = M.schema({
  // Nested objects
  address: M.object({
    street: M.string(),
    city: M.string(),
    coordinates: M.object({
      lat: M.number(),
      lng: M.number()
    })
  }),
  
  // Arrays
  tags: M.array(M.string()),
  scores: M.array(M.number()),
  
  // Array of objects
  contacts: M.array(
    M.object({
      type: M.string(),
      value: M.string()
    })
  ).optional(),
});
```

### Timestamps

```typescript
const schema = M.schema({
  name: M.string(),
  email: M.string()
}).withTimestamps(); // Adds createdAt and updatedAt
```

### Type Inference

```typescript
import type { M } from "mongster";

const userSchema = M.schema({
  name: M.string(),
  age: M.number()
});

// Infer the output type (what you get from database)
type User = M.infer<typeof userSchema>;
// { name: string; age: number }

// Infer the input type (what you provide when creating)
type UserInput = M.inferInput<typeof userSchema>;
// { name: string; age: number }
```

## Index Management

Mongster automatically manages indexes for you, creating, updating, and optionally dropping indexes based on your schema definition.

```typescript
const schema = M.schema({
  email: M.string().uniqueIndex(), // Unique index
  username: M.string().index(1), // Ascending index
  lastLogin: M.date().index(-1), // Descending index
  content: M.string().textIndex(), // Text index for full-text search
  location: M.string().hashedIndex(), // Hashed index
  expiresAt: M.date().ttl(3600), // TTL index (expires after 1 hour)
}).addIndex(
  { email: 1, username: 1 }, // Compound index
  { unique: true }
);

// Indexes are automatically synced when you connect
await mongster.connect(uri, {
  autoIndex: { syncOnConnect: true }
});

// Or manually sync indexes
await User.syncIndexes();
```

## CRUD Operations

### Create

```typescript
// Insert one document
const result = await User.insertOne({
  name: "Alice",
  email: "alice@example.com",
  age: 25
});

// Create and return the document
const user = await User.createOne({
  name: "Bob",
  email: "bob@example.com",
  age: 30
});

// Insert multiple documents
const results = await User.insertMany([
  { name: "Charlie", email: "charlie@example.com", age: 28 },
  { name: "Diana", email: "diana@example.com", age: 32 }
]);

// Create multiple and return documents
const users = await User.createMany([
  { name: "Eve", email: "eve@example.com", age: 27 },
  { name: "Frank", email: "frank@example.com", age: 35 }
]);
```

### Read

```typescript
// Find one document
const user = await User.findOne({ email: "alice@example.com" });

// Find multiple documents
const users = await User.find({ age: { $gte: 25 } });

// Find with query builder
const results = await User.find({ age: { $gte: 18 } })
  .include(["name", "email"]) // Include specific fields
  .exclude(["_id"]) // Exclude fields
  .sort({ age: -1 }) // Sort descending by age
  .skip(10)
  .limit(20);

// Find by ID
const user = await User.findById(someObjectId);

// Count documents
const count = await User.countDocuments({ active: true });
```

### Update

```typescript
// Update one document
const result = await User.updateOne(
  { email: "alice@example.com" },
  { $set: { age: 26 } }
);

// Update multiple documents
const result = await User.updateMany(
  { age: { $lt: 18 } },
  { $set: { status: "minor" } }
);

// Find and update
const updatedUser = await User.findOneAndUpdate(
  { email: "bob@example.com" },
  { $inc: { age: 1 } },
  { returnDocument: "after" }
);

// Replace document
const result = await User.replaceOne(
  { _id: someId },
  { name: "New Name", email: "new@example.com", age: 40 }
);
```

### Delete

```typescript
// Delete one document
const result = await User.deleteOne({ email: "alice@example.com" });

// Delete multiple documents
const result = await User.deleteMany({ age: { $lt: 18 } });

// Find and delete
const deletedUser = await User.findOneAndDelete({ email: "bob@example.com" });
```

## Connection Management

```typescript
import { MongsterClient } from "mongster";

// Using the default client
import { mongster } from "mongster";
await mongster.connect("mongodb://localhost:27017/mydb");

// Create a custom client
const client = new MongsterClient();
await client.connect("mongodb://localhost:27017/mydb", {
  retryConnection: 3, // Retry connection 3 times
  retryDelayMs: 500, // Wait 500ms between retries
  autoIndex: { syncOnConnect: true }, // Sync indexes on connect
  // ... other MongoDB client options
});

// Check connection
const isConnected = await client.ping();

// Disconnect
await client.disconnect();
```

## Transactions

Mongster provides built-in transaction support with automatic session management:

```typescript
// Simple transaction
await client.transaction(async (ctx) => {
  const user = await User.createOne({ name: "Alice", email: "alice@example.com" }, ctx.session);
  await Log.createOne({ userId: user._id, action: "created" }, ctx.session);
});

// Transaction with automatic session injection
await client.transaction(async (ctx) => {
  const ScopedUser = ctx.use(User);
  const ScopedLog = ctx.use(Log);
  
  const user = await ScopedUser.createOne({ name: "Bob", email: "bob@example.com" });
  await ScopedLog.createOne({ userId: user._id, action: "created" });
});

// Transaction with options
await client.transaction(
  async (ctx) => {
    // ... transaction logic
  },
  { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }
);

// Manual session management (advanced)
const session = await client.startSession();
try {
  const user = await User.createOne({ name: "Charlie", email: "charlie@example.com" }, { session });
  // ... more operations
} finally {
  await session.endSession();
}
```

Transactions automatically handle commit/rollback and session cleanup. Use `ctx.use(model)` for automatic session injection, or pass `{ session }` manually to individual operations.

## Advanced Filtering

Mongster provides type-safe filtering with MongoDB query operators:

```typescript
// Comparison operators
await User.find({ age: { $eq: 25 } });
await User.find({ age: { $ne: 25 } });
await User.find({ age: { $gt: 25 } });
await User.find({ age: { $gte: 25 } });
await User.find({ age: { $lt: 25 } });
await User.find({ age: { $lte: 25 } });
await User.find({ age: { $in: [25, 30, 35] } });
await User.find({ age: { $nin: [25, 30] } });

// Logical operators
await User.find({ $and: [{ age: { $gte: 18 } }, { status: "active" }] });
await User.find({ $or: [{ age: { $lt: 18 } }, { status: "inactive" }] });
await User.find({ $not: { age: { $lt: 18 } } });

// Array operators
await User.find({ tags: { $all: ["javascript", "typescript"] } });
await User.find({ tags: { $elemMatch: { $eq: "mongodb" } } });
await User.find({ tags: { $size: 3 } });
```

## Error Handling

```typescript
import { MError } from "mongster";

try {
  const user = await User.createOne({
    name: "Invalid",
    age: 150 // Exceeds max value
  });
} catch (error) {
  if (error instanceof MError) {
    console.error("Validation error:", error.message);
  }
}
```

## Multiple Clients

You can create multiple client instances for different databases:

```typescript
import { MongsterClient, model } from "mongster";

// Client for main database
const mainClient = new MongsterClient();
await mainClient.connect("mongodb://localhost:27017/main");

// Client for analytics database
const analyticsClient = new MongsterClient();
await analyticsClient.connect("mongodb://localhost:27017/analytics");

// Models for different clients
const User = mainClient.model("users", userSchema);
const Event = analyticsClient.model("events", eventSchema);
```

## API Reference

### Schema Builder Methods

- `M.string()` - String type
- `M.number()` - Number type
- `M.boolean()` - Boolean type
- `M.date()` - Date type
- `M.objectId()` - MongoDB ObjectId type
- `M.binary()` - Binary data type
- `M.decimal128()` - Decimal128 type
- `M.object(shape)` - Nested object
- `M.array(schema)` - Array of items
- `M.union([...schemas])` - Union type (one of)
- `M.tuple([...schemas])` - Tuple type (fixed-length array)

### Schema Modifiers

- `.optional()` - Make field optional
- `.nullable()` - Allow null values
- `.default(value)` - Set default value
- `.defaultFn(fn)` - Set default value from function
- `.min(n)` - Minimum value/length
- `.max(n)` - Maximum value/length
- `.enum([...values])` - Enum values
- `.match(regex)` - Pattern matching (strings)
- `.index(direction)` - Create index (1 for ascending, -1 for descending)
- `.uniqueIndex()` - Create unique index
- `.sparseIndex()` - Create sparse index
- `.textIndex()` - Create text index
- `.hashedIndex()` - Create hashed index
- `.ttl(seconds)` - Create TTL index (only for Date fields)

### Model Methods

**Create**
- `insertOne(doc, options?)` - Insert one document
- `insertMany(docs, options?)` - Insert multiple documents
- `createOne(doc, options?)` - Insert and return document
- `createMany(docs, options?)` - Insert and return documents

**Read**
- `find(filter, options?)` - Find documents with query builder
- `findOne(filter, options?)` - Find one document
- `findById(id, options?)` - Find by ObjectId
- `countDocuments(filter, options?)` - Count documents
- `estimatedDocumentCount(options?)` - Estimated count
- `distinct(field, filter?, options?)` - Get distinct values
- `aggregate(pipeline, options?)` - Run aggregation pipeline

**Update**
- `updateOne(filter, update, options?)` - Update one document
- `updateMany(filter, update, options?)` - Update multiple documents
- `replaceOne(filter, doc, options?)` - Replace document
- `findOneAndUpdate(filter, update, options?)` - Find and update
- `findOneAndReplace(filter, doc, options?)` - Find and replace

**Delete**
- `deleteOne(filter, options?)` - Delete one document
- `deleteMany(filter, options?)` - Delete multiple documents
- `findOneAndDelete(filter, options?)` - Find and delete

**Index Management**
- `syncIndexes(options?)` - Synchronize indexes with schema
- `getCollection()` - Get underlying MongoDB collection

### Client Methods

**Connection**
- `connect(uri?, options?)` - Connect to MongoDB
- `disconnect()` - Disconnect from MongoDB
- `ping()` - Check connection status

**Transactions**
- `transaction(callback, options?)` - Execute a transaction with automatic commit/rollback
- `startSession(options?)` - Start a manual MongoDB session

**Models**
- `model(name, schema)` - Create a model instance

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report bugs](https://github.com/IshmamR/mongster/issues)
- 💡 [Request features](https://github.com/IshmamR/mongster/issues)

## License

MIT - see [LICENSE](LICENSE) for details

## Links

- **GitHub**: [IshmamR/mongster](https://github.com/IshmamR/mongster)
- **npm**: [mongster](https://www.npmjs.com/package/mongster)
- **Issues**: [Report a bug](https://github.com/IshmamR/mongster/issues)
- **Author**: [IshmamR](https://github.com/IshmamR)
