/** biome-ignore-all lint/suspicious/noConsole: script file */
import { confirm, input, select } from "@inquirer/prompts";
import { $ } from "bun";

interface PackageJson {
  name: string;
  version: string;
}

interface NpmVersionInfo {
  latest?: string;
  next?: string;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

interface VersionSuggestion {
  patch: string;
  minor: string;
  major: string;
  prePatch: string;
  preMinor: string;
  preMajor: string;
}

/**
 * Get package.json contents
 */
async function getPackageJson(): Promise<PackageJson> {
  const file = Bun.file("package.json");
  return await file.json();
}

/**
 * Get published npm version
 */
async function getNpmVersion(packageName: string): Promise<NpmVersionInfo> {
  try {
    const result = await $`npm view ${packageName} dist-tags --json`.quiet().text();
    return JSON.parse(result);
  } catch (error) {
    console.log("⚠️  Package not found on npm (first release?)");
    console.error(error);
    return {};
  }
}

/**
 * Parse semantic version
 */
function parseVersion(version: string): ParsedVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (!major || !minor || !patch) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: match[4],
  };
}

/**
 * Compare versions
 */
function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major - p2.major;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch;

  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Generate next version suggestions
 */
function generateVersionSuggestions(currentVersion: string): VersionSuggestion {
  const parsed = parseVersion(currentVersion);

  return {
    patch: `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`,
    minor: `${parsed.major}.${parsed.minor + 1}.0`,
    major: `${parsed.major + 1}.0.0`,
    prePatch: `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-beta.0`,
    preMinor: `${parsed.major}.${parsed.minor + 1}.0-beta.0`,
    preMajor: `${parsed.major + 1}.0.0-beta.0`,
  };
}

/**
 * Update package.json version
 */
async function updatePackageVersion(newVersion: string): Promise<void> {
  await $`npm version ${newVersion} --no-git-tag-version`.quiet();
}

/**
 * Create and push git tag
 */
async function createGitTag(version: string): Promise<void> {
  const tag = `v${version}`;

  try {
    await $`git rev-parse ${tag}`.quiet();
    console.log(`\n⚠️  Tag ${tag} already exists!`);
    const shouldDelete = await confirm({
      message: "Delete existing tag and continue?",
      default: false,
    });

    if (!shouldDelete) {
      console.log("❌ Release cancelled");
      process.exit(0);
    }

    await $`git tag -d ${tag}`.quiet();
    await $`git push origin :refs/tags/${tag}`.quiet();
    console.log(`✓ Deleted existing tag ${tag}`);
  } catch {
    // tag does not exist. continues
  }

  await $`git tag -a ${tag} -m "Release ${tag}"`;
  console.log(`✓ Created tag ${tag}`);

  const shouldPush = await confirm({
    message: `Push tag ${tag} to trigger release?`,
    default: true,
  });

  if (shouldPush) {
    await $`git push origin ${tag}`;
    console.log(`\n🚀 Tag pushed! Release workflow will start automatically.`);
    console.log(`   View progress: https://github.com/IshmamR/mongster/actions`);
  } else {
    console.log(`\n📌 Tag created locally. Push manually with:`);
    console.log(`   git push origin ${tag}`);
  }
}

/**
 * Main release script
 */
async function main() {
  console.log("🦖 Mongster Release Script\n");

  try {
    const status = await $`git status --porcelain`.text();
    if (status.trim()) {
      console.log("❌ Git working directory is not clean.");
      console.log("   Please commit or stash your changes first.\n");
      process.exit(1);
    }
  } catch (error) {
    console.log("❌ Not a git repository");
    console.error(error);
    process.exit(1);
  }

  const pkg = await getPackageJson();
  const currentVersion = pkg.version;

  console.log(`📦 Package: ${pkg.name}`);
  console.log(`📌 Current version (package.json): ${currentVersion}\n`);

  const npmVersions = await getNpmVersion(pkg.name);

  if (npmVersions.latest) {
    console.log(`📡 Published version (npm latest): ${npmVersions.latest}`);

    const comparison = compareVersions(currentVersion, npmVersions.latest);
    if (comparison < 0) {
      console.log("⚠️  Warning: Current version is LOWER than published version!");
    } else if (comparison === 0) {
      console.log("⚠️  Warning: Current version is SAME as published version!");
    } else {
      console.log("✓ Current version is higher than published version");
    }
  }

  if (npmVersions.next) {
    console.log(`📡 Published version (npm next): ${npmVersions.next}`);
  }

  console.log();

  const suggestions = generateVersionSuggestions(currentVersion);

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: `Release current version (${currentVersion})`, value: "current" },
      { name: "Bump to new version", value: "bump" },
      { name: "Enter custom version", value: "custom" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  if (action === "cancel") {
    console.log("❌ Release cancelled");
    process.exit(0);
  }

  let releaseVersion = currentVersion;

  if (action === "bump") {
    const versionType = await select({
      message: "Select version bump type:",
      choices: [
        { name: `Patch (${suggestions.patch}) - Bug fixes`, value: "patch" },
        { name: `Minor (${suggestions.minor}) - New features`, value: "minor" },
        { name: `Major (${suggestions.major}) - Breaking changes`, value: "major" },
        { name: `Prepatch (${suggestions.prePatch}) - Beta patch`, value: "prepatch" },
        { name: `Preminor (${suggestions.preMinor}) - Beta minor`, value: "preminor" },
        { name: `Premajor (${suggestions.preMajor}) - Beta major`, value: "premajor" },
      ],
    });

    releaseVersion = suggestions[versionType as keyof typeof suggestions];

    console.log(`\n📝 Updating package.json to ${releaseVersion}...`);
    await updatePackageVersion(releaseVersion);

    await $`git add package.json`;
    await $`git commit -m "chore: bump version to ${releaseVersion}"`;
    console.log(`✓ Committed version bump`);
  } else if (action === "custom") {
    releaseVersion = await input({
      message: "Enter version (without 'v' prefix):",
      default: currentVersion,
      validate: (value) => {
        try {
          parseVersion(value);
          return true;
        } catch (error) {
          if (error instanceof Error) return error.message;
          return "Invalid version format (expected: X.Y.Z or X.Y.Z-prerelease)";
        }
      },
    });

    if (releaseVersion !== currentVersion) {
      console.log(`\n📝 Updating package.json to ${releaseVersion}...`);
      await updatePackageVersion(releaseVersion);

      await $`git add package.json`;
      await $`git commit -m "chore: bump version to ${releaseVersion}"`;
      console.log(`✓ Committed version bump`);
    }
  }

  console.log(`\n📋 Release Summary:`);
  console.log(`   Package: ${pkg.name}`);
  console.log(`   Version: ${releaseVersion}`);
  console.log(`   Tag: v${releaseVersion}`);
  console.log();

  const shouldContinue = await confirm({
    message: "Create release tag?",
    default: true,
  });

  if (!shouldContinue) {
    console.log("❌ Release cancelled");
    process.exit(0);
  }

  await createGitTag(releaseVersion);

  console.log("\n✅ Release process complete!");
  console.log(
    "\n💡 The GitHub Actions workflow will now:\n   1. Run tests\n   2. Build the package\n   3. Publish to npm\n   4. Create GitHub release\n",
  );
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
