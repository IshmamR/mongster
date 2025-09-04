# Contributing to mongster

Thanks for your interest! The project is early and APIs may change quickly.

- Use Bun for dev: `bun install`, `bun run typecheck`, `bun run build`.
- Keep the API chainable and strictly typed via interfaces. Avoid decorators.
- Prefer small, focused PRs with tests (when applicable) and docs updates.
- Code style: follow `tsconfig.json` strictness; no additional lint tool yet.

## Project layout

- `src/` – library source (TypeScript)
- `dist/` – build output (ESM + d.ts)
- `README.md` – quick start & API preview
- `DESIGN.md` – philosophy & decisions
- `ROADMAP.md` – upcoming work

## Running tests

Tests are TBD for v0. Basic placeholder is wired. Use Bun's test runner once we add specs.

## Release process

1) Update changelog (future) and docs.
2) Ensure version in `package.json` is correct.
3) `bun run prepublishOnly` (builds).
4) `npm publish --access public`.

## Commit messages

Use clear, imperative messages. Example: `feat(query): add $in operator`.
