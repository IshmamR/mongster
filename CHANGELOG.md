# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- query hooks for read/write/bulk operations
- `bulkWrite()` on models and transaction-scoped models
- populate support for `find()`, `findOne()`, and `findById()` via `M.objectId().ref(() => Model)`
- type-safe aggregation builder via `model.aggregate()` and transaction-scoped `aggregate()`
- typed stages for `match`, `group`, `sort`, `limit`, `skip`, `project`, `unwind`, `lookup`, `addFields`, `count`, `raw`, and `explain`
- aggregation tests covering grouping, lookup, unwind, complex pipelines, and transactions

### Changed
- `findOne()` and `findById()` now return thenable query builders to support `.populate()` before execution
- docs updated to reflect current API surface and known caveats

### Caveats
- populate currently supports only top-level ref fields declared as `M.objectId().ref(() => Model)`
- array refs are not populatable yet
- `.ref()` is terminal for now; chaining `optional()`, `nullable()`, or default modifiers after `.ref()` is not supported
- aggregation type inference is strongest for field-path, literal, and nested-object expressions; advanced Mongo expression operators still need `raw()` or an explicit generic escape hatch

## [0.0.14] - 2025-12-05

### Added
- Initial changelog setup
- CI workflows for testing and build validation

### Changed
- Improved manual release process
