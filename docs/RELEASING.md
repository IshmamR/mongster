# Releasing Mongster (Manual)

This project uses **manual npm releases**.

## Prerequisites

- Clean git working tree (no uncommitted changes)
- npm account with publish permission for `mongster`
- npm auth set up on your machine (`npm login`)
- Access to push to the repository

## Recommended Flow (using script)

From repo root:

```bash
bun run release
```

The script will:

1. Read current version from `package.json`
2. Compare against npm published versions
3. Let you choose:
   - release current version
   - bump version (patch/minor/major/pre*)
   - custom version
4. If version is changed, commit the version bump
5. Run `bun run prepublishOnly` (clean + test + build)
6. Publish to npm:
   - stable versions → `latest`
   - pre-release versions (`-beta.*`, etc.) → `next`
7. Create git tag `v<version>`
8. Optionally push the tag to `origin`

## Manual Flow (without script)

If needed, you can do everything manually:

```bash
# 1) choose version
npm version <x.y.z> --no-git-tag-version

# 2) commit version bump
git add package.json
git commit -m "chore: bump version to <x.y.z>"

# 3) run release checks
bun run prepublishOnly

# 4) publish
npm publish --access public
# prerelease channel example:
# npm publish --access public --tag next

# 5) tag + push
git tag -a v<x.y.z> -m "Release v<x.y.z>"
git push origin main
git push origin v<x.y.z>
```

## Notes

- If a local or remote tag already exists, the script will ask before replacing/deleting it.
- If publish fails, no new tag push should be performed.
- Keep `CHANGELOG.md` updated as part of your release process.
