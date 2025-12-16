## 📝 Description


## 🔗 Related Issue

Fixes/Addresses/Implements #(issue)

## ✨ Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style update (formatting, renaming)
- [ ] ♻️ Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Build configuration change
- [ ] 🔒 Security fix

## 🧪 Testing

- [ ] Tests pass locally (`bun run test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)

## 📸 Screenshots / Examples

```typescript
const userSchema = M.schema({
  name: M.string(),
  age: M.number(),
  gender: M.boolean(),
  dob: M.date().optional(),
});
const UserModel = mongster.model("users", userSchema);
const result = await UserModel.createOne(createData);
```

## ✅ Checklist

- [ ] My code follows the project's code style
- [ ] I have commented my code in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] Any dependent changes have been merged and published

## 📚 Documentation

- [ ] README.md updated (if needed)
- [ ] JSDoc comments added/updated
- [ ] Examples added/updated (if applicable)

## 💭 Additional Notes
