# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-06-26

### Added

- JSR publish CI workflow with OIDC provenance

### Changed

- CONTRIBUTING.md simplified to focus on maintainer release flow

### Fixed

- Cross-runtime compatibility: `setTimeout` scoped to `globalThis` for Deno/JSR support
- Client options type cast to satisfy JSR's stricter type checking

## [0.3.2] - 2026-06-20

### Added

- npm publish CI workflow with OIDC provenance
- Build pipeline validation script (`checkInlineImports.ts`) to prevent inline import types in emitted declarations

### Changed

- `mongodb` moved from dependency to peer dependency for cleaner version resolution
- README fully rewritten with quick-start examples and clearer feature docs
- Release script (`scripts/release.ts`) improved with version suggestions and tag management
- Dev dependency bumps: Bun 1.3.14, `@types/bun` 1.3.14

## [0.3.0] - 2026-05-02

### Added

- populate support for `find()`, `findOne()`, and `findById()` via `M.objectId().ref(() => Model)`
- schema hooks for read, write, delete, and bulkWrite operations
- type-safe aggregation builder with typed `match`, `group`, `sort`, `limit`, `skip`, `project`, `unwind`, `lookup`, `addFields`, `count`, `raw`, and `explain` stages
- `findById()`, configurable timestamps, and expanded schema validation test coverage

### Changed

- simplified `FindOneQuery` and `FindQuery` return types
- improved update validation and `$setOnInsert` handling
- consolidated package documentation into `README.md` with transactions included inline
- moved maintainer release flow into `CONTRIBUTING.md` and kept manual release process as project default

## [0.2.0] - 2025-12-25

### Added

- transaction API via `mongster.transaction(async (ctx) => { ... })`
- `startSession()` support for manual MongoDB session control

### Changed

- release automation and tagging flow updated around the 0.2.0 release line

## [0.1.1] - 2025-12-16

### Changed

- npm publishing workflow cleanup for the 0.1.x release line

## [0.1.0] - 2025-12-16

### Added

- initial 0.1.x package line
- Release Please setup for automated publishing experiments

### Changed

- package version moved from 0.0.x to 0.1.0

## [0.0.14] - 2025-12-05

### Added

- Initial changelog setup
- CI workflows for testing and build validation

### Changed

- Improved manual release process
