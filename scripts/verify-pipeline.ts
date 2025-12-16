/** biome-ignore-all lint/suspicious/noConsole: script file */
import { readdir } from "node:fs/promises";
import { $ } from "bun";

const GREEN = "\x1b[0;32m";
const RED = "\x1b[0;31m";
const YELLOW = "\x1b[1;33m";
const NC = "\x1b[0m";

function success(message: string) {
  console.log(`${GREEN}✓${NC} ${message}`);
}

function error(message: string) {
  console.log(`${RED}✗${NC} ${message}`);
}

function warning(message: string) {
  console.log(`${YELLOW}⚠${NC} ${message}`);
}

async function fileExists(path: string): Promise<boolean> {
  const file = Bun.file(path);
  return await file.exists();
}

async function checkWorkflows() {
  console.log("📋 Checking workflow files...");
  const workflows = [".github/workflows/ci.yml", ".github/workflows/release-please.yml"];
  for (const workflow of workflows) {
    if (await fileExists(workflow)) {
      success(workflow);
    } else {
      error(`${workflow} - MISSING`);
    }
  }
  console.log();
}

async function checkDocumentation() {
  console.log("📚 Checking documentation...");
  const docs = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE"];

  for (const doc of docs) {
    if (await fileExists(doc)) {
      success(doc);
    } else {
      error(`${doc} - MISSING`);
    }
  }
  console.log();
}

async function checkIssueTemplates() {
  console.log("🎫 Checking issue templates...");

  if (await readdir(".github/ISSUE_TEMPLATE")) {
    success(".github/ISSUE_TEMPLATE directory exists");

    if (await fileExists(".github/ISSUE_TEMPLATE/bug_report.yml")) {
      success("Bug report template");
    } else {
      error("Bug report template - MISSING");
    }

    if (await fileExists(".github/ISSUE_TEMPLATE/feature_request.yml")) {
      success("Feature request template");
    } else {
      error("Feature request template - MISSING");
    }
  } else {
    error(".github/ISSUE_TEMPLATE directory - MISSING");
  }
  console.log();
}

async function checkPackageJson() {
  console.log("📦 Checking package.json...");

  if (await fileExists("package.json")) {
    success("package.json exists");

    const file = Bun.file("package.json");
    const content = await file.text();

    if (content.includes('"name": "mongster"')) {
      success("Package name: mongster");
    } else {
      error("Package name not set correctly");
    }

    if (content.includes('"repository"')) {
      success("Repository field configured");
    } else {
      warning("Repository field missing");
    }

    if (content.includes('"files"')) {
      success("Files field configured");
    } else {
      warning("Files field missing");
    }

    const scripts = ["build", "test", "typecheck", "release", "prepublishOnly"];
    for (const script of scripts) {
      if (content.includes(`"${script}":`)) {
        success(`Script: ${script}`);
      } else {
        warning(`Script missing: ${script}`);
      }
    }
  } else {
    error("package.json - MISSING");
  }
  console.log();
}

async function checkGitConfig() {
  console.log("🔧 Checking git configuration...");

  try {
    await $`git rev-parse --git-dir`.quiet();
    success("Git repository initialized");

    try {
      const remote = await $`git remote get-url origin`.quiet().text();
      success(`Git remote configured: ${remote.trim()}`);
    } catch {
      warning("Git remote not configured");
    }
  } catch {
    error("Not a git repository");
  }
  console.log();
}

async function main() {
  console.log("🔍 Verifying Mongster Release Pipeline Setup...");
  console.log();

  await checkWorkflows();
  await checkDocumentation();
  await checkIssueTemplates();
  await checkPackageJson();
  await checkGitConfig();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
