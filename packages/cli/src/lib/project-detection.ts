import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";

export interface ProjectDetection {
  frameworks: string[];
  packageManager: string;
  isTypeScript: boolean;
  dependencies: string[];
}

function parsePackageDependencies(pkg: any): {
  frameworks: string[];
  dependencies: string[];
} {
  const frameworksSet = new Set<string>();
  const dependencies: string[] = [];

  if (pkg && typeof pkg === "object") {
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const dep of Object.keys(allDeps)) {
      dependencies.push(dep);
      if (dep === "next") frameworksSet.add("Next.js");
      if (dep === "nuxt" || dep === "vue") frameworksSet.add("Vue/Nuxt");
      if (dep === "react" && !frameworksSet.has("Next.js"))
        frameworksSet.add("React");
      if (dep === "svelte" || dep === "@sveltejs/kit")
        frameworksSet.add("Svelte");
      if (dep === "hono") frameworksSet.add("Hono");
      if (dep === "prisma") frameworksSet.add("Prisma");
      if (dep === "tailwindcss") frameworksSet.add("TailwindCSS");
    }
  }

  // Ensure "React" is not included if "Next.js" is in frameworksSet
  if (frameworksSet.has("Next.js")) {
    frameworksSet.delete("React");
  }

  return {
    frameworks: Array.from(frameworksSet),
    dependencies,
  };
}

function extractDetectorsSync(
  cwd: string,
  packageJsonContent: string | null,
  tsconfigExists: boolean,
): ProjectDetection {
  let packageManager = "npm";
  const isTypeScript = tsconfigExists;

  // Detect package manager based on lockfiles
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
    packageManager = "bun";
  } else if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (existsSync(join(cwd, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (existsSync(join(cwd, "package-lock.json"))) {
    packageManager = "npm";
  }

  let frameworks: string[] = [];
  let dependencies: string[] = [];

  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      const parsed = parsePackageDependencies(pkg);
      frameworks = parsed.frameworks;
      dependencies = parsed.dependencies;
    } catch {
      // Ignored
    }
  }

  return {
    frameworks,
    packageManager,
    isTypeScript,
    dependencies: dependencies.slice(0, 50), // Cap at 50 to avoid massive payloads
  };
}

export function detectProjectStackSync(): ProjectDetection {
  const cwd = process.cwd();
  const packageJsonPath = join(cwd, "package.json");
  const tsconfigPath = join(cwd, "tsconfig.json");

  let packageJsonContent: string | null = null;
  if (existsSync(packageJsonPath)) {
    try {
      packageJsonContent = readFileSync(packageJsonPath, "utf-8");
    } catch {}
  }

  const tsconfigExists = existsSync(tsconfigPath);
  return extractDetectorsSync(cwd, packageJsonContent, tsconfigExists);
}

export async function detectProjectStack(): Promise<ProjectDetection> {
  const cwd = process.cwd();
  const packageJsonPath = join(cwd, "package.json");
  const tsconfigPath = join(cwd, "tsconfig.json");

  let packageJsonContent: string | null = null;
  if (existsSync(packageJsonPath)) {
    try {
      packageJsonContent = await readFile(packageJsonPath, "utf-8");
    } catch {}
  }

  const tsconfigExists = existsSync(tsconfigPath);
  return extractDetectorsSync(cwd, packageJsonContent, tsconfigExists);
}
