import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";

export interface ProjectDetection {
  frameworks: string[];
  packageManager: string;
  isTypeScript: boolean;
  dependencies: string[];
}

export function detectProjectStackSync(): ProjectDetection {
  const cwd = process.cwd();
  const packageJsonPath = join(cwd, "package.json");
  const tsconfigPath = join(cwd, "tsconfig.json");

  const frameworks: string[] = [];
  let packageManager = "npm";
  let isTypeScript = false;
  const dependencies: string[] = [];

  if (existsSync(tsconfigPath)) {
    isTypeScript = true;
  }

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

  if (existsSync(packageJsonPath)) {
    try {
      const content = readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      for (const dep of Object.keys(allDeps)) {
        dependencies.push(dep);
        if (dep === "next") frameworks.push("Next.js");
        if (dep === "nuxt" || dep === "vue") frameworks.push("Vue/Nuxt");
        if (dep === "react" && !frameworks.includes("Next.js")) frameworks.push("React");
        if (dep === "svelte" || dep === "@sveltejs/kit") frameworks.push("Svelte");
        if (dep === "hono") frameworks.push("Hono");
        if (dep === "prisma") frameworks.push("Prisma");
        if (dep === "tailwindcss") frameworks.push("TailwindCSS");
      }
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

export async function detectProjectStack(): Promise<ProjectDetection> {
  const cwd = process.cwd();
  const packageJsonPath = join(cwd, "package.json");
  const tsconfigPath = join(cwd, "tsconfig.json");

  const frameworks: string[] = [];
  let packageManager = "npm";
  let isTypeScript = false;
  const dependencies: string[] = [];

  if (existsSync(tsconfigPath)) {
    isTypeScript = true;
  }

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

  if (existsSync(packageJsonPath)) {
    try {
      const content = await readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      for (const dep of Object.keys(allDeps)) {
        dependencies.push(dep);
        if (dep === "next") frameworks.push("Next.js");
        if (dep === "nuxt" || dep === "vue") frameworks.push("Vue/Nuxt");
        if (dep === "react" && !frameworks.includes("Next.js")) frameworks.push("React");
        if (dep === "svelte" || dep === "@sveltejs/kit") frameworks.push("Svelte");
        if (dep === "hono") frameworks.push("Hono");
        if (dep === "prisma") frameworks.push("Prisma");
        if (dep === "tailwindcss") frameworks.push("TailwindCSS");
      }
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
