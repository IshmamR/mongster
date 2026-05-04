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

async function getPackageJson(): Promise<PackageJson> {
  const file = Bun.file("package.json");
  return await file.json();
}

async function getNpmVersion(packageName: string): Promise<NpmVersionInfo> {
  try {
    const result = await $`npm view ${packageName} dist-tags --json`.quiet().text();
    return JSON.parse(result);
  } catch {
    console.log("⚠️  Package not found on npm (first release?)");
    return {};
  }
}

function parseVersion(version: string): ParsedVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid version format: ${version}`);

  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (!major || !minor || !patch) throw new Error(`Invalid version format: ${version}`);

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: match[4],
  };
}

function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major - p2.major;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch;

  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && p2.prerelease) return p1.prerelease.localeCompare(p2.prerelease);

  return 0;
}

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

async function updatePackageVersion(newVersion: string): Promise<void> {
  await $`npm version ${newVersion} --no-git-tag-version`.quiet();
}

async function ensureCleanGit(): Promise<void> {
  try {
    const status = await $`git status --porcelain`.text();
    if (status.trim()) {
      console.log("❌ Git working directory is not clean.");
      console.log("   Please commit or stash your changes first.\n");
      process.exit(1);
    }
  } catch {
    console.log("❌ Not a git repository");
    process.exit(1);
  }
}

async function createOrReplaceTag(version: string) {
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
    console.log(`✓ Deleted existing local tag ${tag}`);
  } catch {
    // tag does not exist
  }

  await $`git tag -a ${tag} -m "Release ${tag}"`;
  console.log(`✓ Created tag ${tag}`);
}

async function remoteTagExists(tag: string): Promise<boolean> {
  try {
    const output = await $`git ls-remote --tags origin ${tag}`.quiet().text();
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

async function deleteRemoteTag(tag: string) {
  await $`git push origin :refs/tags/${tag}`;
  console.log(`✓ Deleted existing remote tag ${tag}`);
}

async function runReleaseChecks() {
  console.log("\n🧪 Running prepublish checks...");
  await $`bun run prepublishOnly`;
  console.log("✓ Prepublish checks passed");
}

async function publishPackage(tag: "latest" | "next") {
  await $`npm whoami`.quiet();

  if (tag === "next") {
    await $`npm publish --access public --tag next`;
  } else {
    await $`npm publish --access public`;
  }
}

async function main() {
  console.log("🦖 Mongster Manual Release Script\n");

  await ensureCleanGit();

  const pkg = await getPackageJson();
  const currentVersion = pkg.version;

  console.log(`📦 Package: ${pkg.name}`);
  console.log(`📌 Current version (package.json): ${currentVersion}\n`);

  const npmVersions = await getNpmVersion(pkg.name);

  if (npmVersions.latest) {
    console.log(`📡 Published version (npm latest): ${npmVersions.latest}`);
    const comparison = compareVersions(currentVersion, npmVersions.latest);
    if (comparison < 0) console.log("⚠️  Warning: Current version is LOWER than published version!");
    else if (comparison === 0)
      console.log("⚠️  Warning: Current version is SAME as published version!");
    else console.log("✓ Current version is higher than published version");
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
    console.log("✓ Committed version bump");
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
      console.log("✓ Committed version bump");
    }
  }

  const npmTag = releaseVersion.includes("-") ? "next" : "latest";

  console.log("\n📋 Release Summary:");
  console.log(`   Package: ${pkg.name}`);
  console.log(`   Version: ${releaseVersion}`);
  console.log(`   npm tag: ${npmTag}`);
  console.log(`   Git tag: v${releaseVersion}`);
  console.log();

  const shouldContinue = await confirm({
    message: "Run checks, publish to npm, and create git tag now?",
    default: true,
  });

  if (!shouldContinue) {
    console.log("❌ Release cancelled");
    process.exit(0);
  }

  await runReleaseChecks();
  await publishPackage(npmTag as "latest" | "next");
  await createOrReplaceTag(releaseVersion);

  const shouldPushTag = await confirm({
    message: `Push tag v${releaseVersion} to origin?`,
    default: true,
  });

  if (shouldPushTag) {
    const tag = `v${releaseVersion}`;
    if (await remoteTagExists(tag)) {
      console.log(`\n⚠️  Remote tag ${tag} already exists.`);
      const shouldDeleteRemote = await confirm({
        message: `Delete remote tag ${tag} and continue push?`,
        default: false,
      });

      if (!shouldDeleteRemote) {
        console.log(`📌 Skipping tag push. Remote tag ${tag} was kept.`);
        console.log("✅ Manual release complete!");
        return;
      }

      await deleteRemoteTag(tag);
    }

    await $`git push origin v${releaseVersion}`;
    console.log(`✓ Pushed tag v${releaseVersion}`);
  } else {
    console.log(`📌 Tag kept locally. Push manually with: git push origin v${releaseVersion}`);
  }

  console.log("\n✅ Manual release complete!");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\n❌ Error:", message);
  process.exit(1);
});
