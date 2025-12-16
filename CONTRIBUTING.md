# Contributing to Mongster

Thank you for your interest in contributing to Mongster! 🎉

## Getting Started

### Prerequisites

- **Bun** >= 1.2.20 (or Node.js >= 18)
- **Git**
- **MongoDB** (or MongoDB Memory Server for testing)

### Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mongster.git
   cd mongster
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests**
   ```bash
   bun run test
   ```

4. **Build the project**
   ```bash
   bun run build
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feat/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation changes
- `chore/*` - Maintenance tasks
- `refactor/*` - Code refactoring
- `test/*` - Test additions/changes

### 2. Make Your Changes

- Write clear, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 3. Run Checks

```bash
# Type checking
bun run typecheck

# Tests
bun run test

# Linting (with Biome)
bun run lint
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in query builder"
```

Format: `<type>: <description>`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build process or auxiliary tool changes

### 5. Push and Create Pull Request

```bash
git push origin feat/your-feature-name
```

Then create a pull request on GitHub with:
- Clear title and description
- Reference any related issues (#123)
- Screenshots/examples if applicable

## Code Style

### TypeScript

- Use TypeScript for all new code
- Prefer type inference over explicit types where clear (except for function return types)
- Use descriptive variable names
- Add JSDoc comments for public APIs

```typescript
/**
 * Creates a new document in the collection
 * @param data - The document data to insert
 * @returns The created document with _id
 */
async createOne(data: SchemaType): Promise<Document> {
  // Implementation
}
```

### Testing

- Write tests for all new features
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)

```typescript
test("should create document with default values", async () => {
  // arrange
  const schema = M.schema({ name: M.string() });
  const Model = client.model("test", schema);
  
  // act
  const doc = await Model.createOne({ name: "test" });
  
  // assert
  expect(doc.name).toBe("test");
});
```

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Include code examples
- Update CHANGELOG.md for notable changes

## Pull Request Process

1. **Ensure CI passes**
   - All tests pass
   - Type checking passes
   - Linting passes
   - Build succeeds

2. **Request review**
   - Tag maintainers if needed
   - Respond to feedback promptly

3. **Keep PR focused**
   - One feature/fix per PR
   - Split large changes into smaller PRs

4. **Update documentation**
   - Update relevant docs
   - Add examples if needed

5. **Squash commits** (maintainers should handle this during merge)

## Areas for Contribution

### High Priority
- 🐛 Bug fixes
- 📝 Documentation improvements
- ✅ Test coverage
- 🎯 Performance optimizations

### Feature Ideas
- Additional schema types
- Query builder enhancements
- Migration utilities
- Connection pooling improvements
- Aggregation pipeline builder

### Good First Issues
Check issues labeled [`good first issue`](https://github.com/IshmamR/mongster/labels/good%20first%20issue)

## Testing

### Running Tests

```bash
# All tests
bun run test

# Specific test file
bun test test/schema.test.ts

# Watch mode
bun test --watch
```

### Writing Tests

- Use MongoDB Memory Server for isolated testing
- Clean up resources in `afterAll` hooks
- Use meaningful test descriptions
- Test edge cases and error conditions

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

Reviewers will check for:
- ✅ Code quality and style
- ✅ Test coverage
- ✅ Documentation completeness
- ✅ Breaking changes
- ✅ Performance implications

## Community

- Be respectful and constructive
- Help others in discussions
- Share knowledge and learnings

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Reach out to maintainer: ishmam785@gmail.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making Mongster better! 🚀
