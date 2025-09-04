# Roadmap

## ✅ Completed (v0.0.1)

### Core Schema System
- [x] Schema definition with `createSchema()`
- [x] Rich type system (primitives, arrays, nested documents, unions)
- [x] Type inference engine (`InferInputType`, `InferDocumentType`)
- [x] Nested document support with subdocument arrays
- [x] Union types with proper TypeScript inference
- [x] Field options (required, nullable, default values)

### Query System
- [x] Model creation with `createModel()`
- [x] Chainable query API (`.find()`, `.findOne()`)
- [x] Type-safe filtering with MongoDB operators
- [x] Sorting with nested path support (`.sort()`)
- [x] Field projection with type inference (`.project()`)
- [x] Pagination (`.limit()`, `.skip()`)
- [x] Nested path queries (`"address.city"`)
- [x] Query execution (`.exec()`)

### MongoDB Integration
- [x] Connection management with `createConnection()`
- [x] Official MongoDB driver integration
- [x] Collection operations with proper typing

## 🚧 Current Focus (v0.1.0)

### Query Enhancements
- [ ] Selection API improvements (`.select()`)
- [ ] Aggregation pipeline support
- [ ] Index management helpers
- [ ] Advanced MongoDB operators ($regex, $exists, etc.)

### Type System Improvements
- [ ] Better error messages for complex type failures
- [ ] Performance optimization for deep nested types
- [ ] Support for self-referencing schemas
- [ ] Conditional field types

### Developer Experience
- [ ] Comprehensive test suite
- [ ] Better documentation with more examples
- [ ] Error handling and validation
- [ ] Performance benchmarks

## 📋 Short-term (v0.2.0)

### CRUD Operations
- [ ] Insert operations (`.insertOne()`, `.insertMany()`)
- [ ] Update operations (`.updateOne()`, `.updateMany()`)
- [ ] Delete operations (`.deleteOne()`, `.deleteMany()`)
- [ ] Upsert support

### Advanced Queries
- [ ] Aggregation framework integration
- [ ] Text search support
- [ ] Geospatial queries
- [ ] Complex filtering with $lookup equivalent

### Validation & Safety
- [ ] Optional runtime schema validation
- [ ] Input sanitization
- [ ] Query optimization hints
- [ ] Connection pooling management

## 🎯 Medium-term (v0.3.0+)

### Enterprise Features
- [ ] Transaction support with sessions
- [ ] Change streams integration
- [ ] Replica set awareness
- [ ] Sharding considerations

### Schema Evolution
- [ ] Schema migrations
- [ ] Versioning support
- [ ] Backward compatibility helpers
- [ ] Schema diffing tools

### Performance & Monitoring
- [ ] Query performance monitoring
- [ ] Connection health checks
- [ ] Metrics and observability
- [ ] Query caching strategies

## 🚀 Long-term Vision

### Advanced Type System
- [ ] Schema inheritance and composition
- [ ] Conditional schemas based on field values
- [ ] Dynamic schema resolution
- [ ] Schema validation at runtime

### Developer Ecosystem
- [ ] CLI tools for schema management
- [ ] VS Code extension for schema intelligence
- [ ] Migration tools from other ODMs
- [ ] Integration with popular frameworks (Next.js, etc.)

### Testing & Quality
- [ ] In-memory MongoDB adapter for testing
- [ ] Property-based testing utilities
- [ ] Performance regression testing
- [ ] Comprehensive benchmarking suite

### Community & Integrations
- [ ] Plugin system for extensibility
- [ ] Integration with validation libraries (Zod, Yup)
- [ ] ORM-style relationships (opt-in)
- [ ] GraphQL schema generation

## 📝 Notes

### Type System Constraints
- Recursive types are limited to depth 3-5 to maintain compilation performance
- Complex union types may require manual type assertions in edge cases
- Template literal types for nested paths have inherent TypeScript limits

### MongoDB Driver Compatibility
- Built on MongoDB Node.js driver v6.x
- Supports MongoDB 4.4+ features
- Maintains compatibility with official driver APIs

### Breaking Changes Policy
- Pre-1.0: Breaking changes allowed with clear migration guides
- Post-1.0: Semantic versioning with deprecated feature warnings
- Focus on compile-time detection of breaking changes

### Performance Targets
- Sub-1ms query building overhead
- Minimal runtime type checking
- Efficient memory usage for large schemas
- Fast TypeScript compilation even with complex schemas