# Publishing mongster v0.0.1

This project targets Bun for dev/build and ships ESM + d.ts.

## One-time setup
- Ensure you are logged in to npm: `npm login`
- Set package name `mongster` and visibility (public)

## Build & publish

1) Clean & build
```bash
bun run clean
bun run build
```

2) Publish to npm (dry run optional)
```bash
npm publish --access public --dry-run
npm publish --access public
```

Notes
- `prepublishOnly` runs the build automatically on `npm publish`.
- Version is `0.0.1` to start a clean history.
- Exports only `dist/` artifacts per `files` field.
