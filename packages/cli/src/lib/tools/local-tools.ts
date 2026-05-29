import { Mode, toolInputSchemas, type ModeType } from "@knightcode/shared";
import fs, { existsSync, lstatSync, realpathSync, readlinkSync } from "fs";
import { mkdir, readFile, readdir, stat, writeFile, unlink, open } from "fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "path";
import readline from "readline";
import { spawnSync } from "child_process";
import safeRegex from "safe-regex";
import { apiClient } from "../api-client";
import { killProcessOnPort, registerProcess } from "../tasks/background-tasks";

import {
  runPreToolHooks,
  runPostToolHooks,
  runPostToolUseFailureHooks,
} from "../hooks";
import { detectShell } from "../shell";

const sessionOriginalContents = new Map<string, Map<string, string | null>>();

function isSafeRegex(pattern: string): boolean {
  return safeRegex(pattern);
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateAndGetRegex(pattern: string, flags: string): RegExp {
  if (!isSafeRegex(pattern)) {
    return new RegExp(escapeRegExp(pattern), flags);
  }
  try {
    return new RegExp(pattern, flags);
  } catch {
    return new RegExp(escapeRegExp(pattern), flags);
  }
}

async function recordOriginalContent(sessionId: string, resolvedPath: string) {
  if (!sessionOriginalContents.has(sessionId)) {
    sessionOriginalContents.set(sessionId, new Map());
  }
  const sessionContents = sessionOriginalContents.get(sessionId)!;
  if (sessionContents.has(resolvedPath)) {
    return;
  }
  if (existsSync(resolvedPath)) {
    try {
      const content = await readFile(resolvedPath, "utf-8");
      sessionContents.set(resolvedPath, content);
    } catch {
      // ignore
    }
  } else {
    sessionContents.set(resolvedPath, null);
  }
}

export async function undoSessionChanges(sessionId: string): Promise<{
  revertedFiles: string[];
  failedFiles: string[];
}> {
  const revertedFiles: string[] = [];
  const failedFiles: string[] = [];

  const sessionContents = sessionOriginalContents.get(sessionId);
  if (!sessionContents) {
    return { revertedFiles, failedFiles };
  }
  const cwd = process.cwd();

  for (const [resolvedPath, originalContent] of sessionContents.entries()) {
    try {
      const relPath = relative(cwd, resolvedPath);
      if (originalContent === null) {
        if (existsSync(resolvedPath)) {
          await unlink(resolvedPath);
        }
      } else {
        await mkdir(dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, originalContent, "utf-8");
      }
      revertedFiles.push(relPath);
      sessionContents.delete(resolvedPath);
    } catch {
      const relPath = relative(cwd, resolvedPath);
      failedFiles.push(relPath);
    }
  }

  if (sessionContents.size === 0) {
    sessionOriginalContents.delete(sessionId);
  }

  return { revertedFiles, failedFiles };
}

const MAX_FILE_SIZE = 100_000;
const MAX_RESULTS = 500;
const MAX_MATCHES = 200;
const MAX_OUTPUT = 50_000;
const DEFAULT_TIMEOUT = 120_000;

function resolveInsideRoot(root: string, path: string, isWrite = false) {
  const resolved = resolve(root, path);

  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = resolve(root);
  }

  let realResolved = resolved;
  try {
    realResolved = realpathSync(resolved);
  } catch {
    let parent = dirname(resolved);
    while (parent && parent !== resolved) {
      try {
        const realParent = realpathSync(parent);
        realResolved = join(realParent, relative(parent, resolved));
        break;
      } catch {
        const nextParent = dirname(parent);
        if (nextParent === parent) {
          realResolved = resolved;
          break;
        }
        parent = nextParent;
      }
    }
    if (!realResolved) {
      realResolved = resolved;
    }
  }

  const rel = relative(realRoot, realResolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Path is outside the project directory");
  }

  if (isWrite) {
    let current = resolved;
    while (current && current.length >= root.length && current !== dirname(current)) {
      try {
        const stats = lstatSync(current);
        if (stats.isSymbolicLink()) {
          const linkTarget = readlinkSync(current);
          const resolvedTarget = resolve(dirname(current), linkTarget);
          const linkRel = relative(realRoot, resolvedTarget);
          if (linkRel.startsWith("..") || isAbsolute(linkRel)) {
            throw new Error("Parent symlink points outside the project directory");
          }
        }
      } catch (err: any) {
        if (err.message?.includes("outside the project directory")) {
          throw err;
        }
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  return { cwd: root, resolved };
}

function assertSafeProjectFile(resolved: string, cwd: string, action: string) {
  const rel = relative(cwd, resolved);
  const parts = rel.split(/[\\/]+/);
  const fileName = basename(resolved).toLowerCase();

  if (parts.includes(".git")) {
    throw new Error(`Refusing to ${action} files inside .git`);
  }

  if (fileName === ".env" || fileName.startsWith(".env.")) {
    throw new Error(`Refusing to ${action} environment/secret files`);
  }
}

function isSafeProjectFile(resolved: string, cwd: string): boolean {
  try {
    assertSafeProjectFile(resolved, cwd, "read");
    return true;
  } catch {
    return false;
  }
}

function assertSafeCommand(command: string) {
  const normalized = command.toLowerCase().replace(/\s+/g, " ").trim();
  const forbiddenPatterns = [
    /\brm\s+(-[^\s]*r[^\s]*f|-rf|-fr)\b/,
    /\bgit\s+push\b.*\s--force(?:\s|$)/,
    /\bgit\s+reset\s+--hard\b/,
    /\bgit\s+clean\s+-[^\s]*f\b/,
    /\bdrop\s+table\b/,
    /\btruncate\s+table\b/,
    /\bdrop\s+database\b/,
    /^format\b/,
    /\bdeltree\b/,
    /\bdel\s+\/[^\s]*s[^\s]*q\b/,
    /\bremove-item\b.*\s-recurse\b.*\s-force\b/,
    /\bchmod\s+777\b/,
    /\bsudo\s+rm\b/,
    /\bkill\s+-9\s+1\b/,
    /:\s*\(\s*\)\s*\{.*\}\s*;\s*:/,
  ];

  if (forbiddenPatterns.some((pattern) => pattern.test(normalized))) {
    throw new Error("Refusing to run a destructive command");
  }
}

function truncate(value: string, limit: number) {
  return value.length > limit
    ? `${value.slice(0, limit)}\n... (truncated, ${value.length} total chars)`
    : value;
}


async function executeLocalToolImpl(
  toolName: string,
  input: unknown,
  mode: ModeType,
  sessionId?: string,
) {
  const sId = sessionId ?? "default";
  const executionRoot = process.cwd();
  if (
    mode === Mode.PLAN &&
    ![
      "readFile",
      "listDirectory",
      "glob",
      "grep",
      "webSearch",
      "webFetch",
      "todoWrite",
      "AskUserQuestion",
      "gitStatus",
      "gitDiff",
      "gitLog",
      "skill",
    ].includes(toolName)
  ) {
    throw new Error(`Tool ${toolName} is not available in PLAN mode`);
  }

  switch (toolName) {
    case "readFile": {
      const { path, offset, limit } = toolInputSchemas.readFile.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path);
      assertSafeProjectFile(resolved, cwd, "read");

      const stats = await stat(resolved);
      const fileSize = stats.size;

      const ext = path.split(".").pop()?.toLowerCase();
      const imageExtensions = [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "ico",
        "svg",
      ];
      if (ext && imageExtensions.includes(ext)) {
        const bytesToRead = Math.min(fileSize, MAX_FILE_SIZE);
        const buffer = Buffer.alloc(bytesToRead);
        const fileHandle = await open(resolved, "r");
        try {
          await fileHandle.read(buffer, 0, bytesToRead, 0);
        } finally {
          await fileHandle.close();
        }

        const mimeType =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "ico"
              ? "image/x-icon"
              : `image/${ext === "jpg" ? "jpeg" : ext}`;
        return {
          content: buffer.toString("base64"),
          isImage: true,
          mimeType,
          totalLength: fileSize,
          truncated: fileSize > MAX_FILE_SIZE,
        };
      }

      // Paginated line-based reading using readline stream to avoid buffering files
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 0;
        const count = limit ?? 200;
        const lines: string[] = [];
        let lineCount = 0;

        const fileStream = fs.createReadStream(resolved, { encoding: "utf-8" });
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          if (lineCount >= start && lineCount < start + count) {
            lines.push(line);
          }
          lineCount++;
        }

        // Distinguish "past EOF" from "empty file" so the caller doesn't
        // confuse a paginated read that ran off the end with a genuinely
        // empty file.
        const pastEof = start >= lineCount && lineCount > 0;
        return {
          content: lines.join("\n"),
          totalLines: lineCount,
          offset: start,
          linesReturned: lines.length,
          truncated: start + count < lineCount,
          pastEof,
        };
      }

      if (fileSize > MAX_FILE_SIZE) {
        const bytesToRead = Math.min(fileSize, MAX_FILE_SIZE * 2);
        const buffer = Buffer.alloc(bytesToRead);
        const fileHandle = await open(resolved, "r");
        try {
          await fileHandle.read(buffer, 0, bytesToRead, 0);
        } finally {
          await fileHandle.close();
        }
        const text = buffer.toString("utf-8");
        return {
          content: text.slice(0, MAX_FILE_SIZE),
          truncated: true,
          totalLength: fileSize,
        };
      } else {
        const raw = await readFile(resolved, "utf-8");
        return { content: raw };
      }
    }
    case "listDirectory": {
      const { path } = toolInputSchemas.listDirectory.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path);
      assertSafeProjectFile(resolved, cwd, "read");
      const entries = await readdir(resolved);
      const results: { name: string; type: "file" | "directory" }[] = [];

      for (const entry of entries) {
        const entryResolved = join(resolved, entry);
        if (!isSafeProjectFile(entryResolved, cwd)) continue;
        if (entry.startsWith(".") || entry === "node_modules") continue;
        const info = await stat(entryResolved);
        results.push({
          name: entry,
          type: info.isDirectory() ? "directory" : "file",
        });
      }

      results.sort((a, b) =>
        a.type !== b.type
          ? a.type === "directory"
            ? -1
            : 1
          : a.name.localeCompare(b.name),
      );
      return { path: relative(cwd, resolved) || ".", entries: results };
    }
    case "glob": {
      const { pattern, path } = toolInputSchemas.glob.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path);
      assertSafeProjectFile(resolved, cwd, "read");
      const glob = new Bun.Glob(pattern);
      const files: string[] = [];
      let truncated = false;

      for await (const match of glob.scan({
        cwd: resolved,
        dot: false,
        onlyFiles: true,
      })) {
        const fileResolved = resolve(resolved, match);
        if (!isSafeProjectFile(fileResolved, cwd)) continue;
        if (match.includes("node_modules")) continue;
        if (files.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
        files.push(relative(cwd, fileResolved));
      }

      files.sort();
      return { files, ...(truncated ? { truncated: true } : {}) };
    }
    case "grep": {
      const {
        pattern,
        path,
        include,
        caseInsensitive,
        contextLines,
        outputMode = "content",
        maxResults = 200,
      } = toolInputSchemas.grep.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path);
      assertSafeProjectFile(resolved, cwd, "read");

      const regex = validateAndGetRegex(pattern, caseInsensitive ? "i" : "");

      // Check if resolved path is a directory or a file
      const stats = await stat(resolved);
      const filesToSearch: string[] = [];

      if (stats.isDirectory()) {
        const globPattern = include ?? "**/*";
        const glob = new Bun.Glob(globPattern);

        for await (const match of glob.scan({
          cwd: resolved,
          dot: false,
          onlyFiles: true,
        })) {
          const fileResolved = resolve(resolved, match);
          if (!isSafeProjectFile(fileResolved, cwd)) continue;
          const isIgnored =
            match.includes("node_modules") ||
            match.includes(".git") ||
            match.includes(".knightcode");
          if (isIgnored) continue;
          filesToSearch.push(fileResolved);
        }
      } else {
        filesToSearch.push(resolved);
      }

      // Sort files to be deterministic
      filesToSearch.sort();

      const results: any[] = [];
      let truncated = false;
      const limit = Math.min(maxResults, MAX_MATCHES);

      // Process files in parallel batches of size 30
      const batchSize = 30;
      for (let i = 0; i < filesToSearch.length; i += batchSize) {
        if (results.length >= limit) {
          truncated = true;
          break;
        }

        const batch = filesToSearch.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (absPath) => {
            try {
              const fStat = await stat(absPath);
              if (fStat.size > 500_000) return null; // skip large files

              const fd = await open(absPath, "r");
              try {
                const buffer = Buffer.alloc(1024);
                const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
                const hasNull = buffer.subarray(0, bytesRead).includes(0);
                if (hasNull) return null; // skip binary
              } finally {
                await fd.close();
              }

              const content = await readFile(absPath, "utf-8");
              const relativePath = relative(cwd, absPath);
              const fileMatches: any[] = [];

              if (outputMode === "files") {
                regex.lastIndex = 0;
                if (regex.test(content)) {
                  fileMatches.push({ file: relativePath });
                }
              } else if (outputMode === "count") {
                const globalRegex = validateAndGetRegex(
                  pattern,
                  caseInsensitive ? "gi" : "g",
                );
                const matches = content.match(globalRegex);
                if (matches && matches.length > 0) {
                  fileMatches.push({ file: relativePath, count: matches.length });
                }
              } else {
                const lines = content.split("\n");
                const matchIndices: number[] = [];

                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i]!;
                  regex.lastIndex = 0;
                  if (regex.test(line)) {
                    matchIndices.push(i);
                  }
                }

                if (matchIndices.length > 0) {
                  if (contextLines === undefined || contextLines <= 0) {
                    for (const idx of matchIndices) {
                      fileMatches.push({
                        file: relativePath,
                        line: idx + 1,
                        type: "match" as const,
                        content: lines[idx]!,
                      });
                    }
                  } else {
                    const includedLines = new Set<number>();
                    for (const idx of matchIndices) {
                      const start = Math.max(0, idx - contextLines);
                      const end = Math.min(lines.length - 1, idx + contextLines);
                      for (let i = start; i <= end; i++) {
                        includedLines.add(i);
                      }
                    }

                    const sortedIncluded = Array.from(includedLines).sort((a, b) => a - b);
                    for (const idx of sortedIncluded) {
                      const isMatch = matchIndices.includes(idx);
                      fileMatches.push({
                        file: relativePath,
                        line: idx + 1,
                        type: isMatch ? ("match" as const) : ("context" as const),
                        content: lines[idx]!,
                      });
                    }
                  }
                }
              }
              return fileMatches;
            } catch {
              return null;
            }
          })
        );

        for (const fileMatches of batchResults) {
          if (fileMatches) {
            for (const match of fileMatches) {
              if (results.length >= limit) {
                truncated = true;
                break;
              }
              results.push(match);
            }
          }
          if (results.length >= limit) {
            truncated = true;
            break;
          }
        }
      }

      return {
        outputMode,
        results,
        ...(truncated ? { truncated: true } : {}),
      };
    }
    case "writeFile": {
      const { path, content } = toolInputSchemas.writeFile.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path, true);
      assertSafeProjectFile(resolved, cwd, "modify");
      await recordOriginalContent(sId, resolved);
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf-8");
      return {
        success: true as const,
        path: relative(cwd, resolved),
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      };
    }
    case "editFile": {
      const { path, oldString, newString, replaceAll } =
        toolInputSchemas.editFile.parse(input);
      const { cwd, resolved } = resolveInsideRoot(executionRoot, path, true);
      assertSafeProjectFile(resolved, cwd, "modify");
      await recordOriginalContent(sId, resolved);
      const content = await readFile(resolved, "utf-8");
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) throw new Error("oldString not found in file");
      if (occurrences > 1 && !replaceAll)
        throw new Error(
          `oldString is ambiguous; found ${occurrences} matches. Use replaceAll: true to replace all.`,
        );

      const updated = replaceAll
        ? content.replaceAll(oldString, newString)
        : content.replace(oldString, newString);

      await writeFile(resolved, updated, "utf-8");
      return {
        success: true as const,
        path: relative(cwd, resolved),
        replacements: replaceAll ? occurrences : 1,
      };
    }
    case "bash": {
      const {
        command,
        timeout = DEFAULT_TIMEOUT,
        runInBackground = false,
        port,
      } = toolInputSchemas.bash.parse(input);
      assertSafeCommand(command);

      // Shell is detected once per process (memoized): pwsh/powershell on Windows,
      // $SHELL (bash/zsh) on Unix. The AI never picks the shell — it's transparent.
      const shell = detectShell();
      const spawnArgs = [shell.bin, ...shell.args, command];

      if (runInBackground) {
        if (port !== undefined) {
          killProcessOnPort(port);
        }

        const proc = Bun.spawn(spawnArgs, {
          cwd: executionRoot,
          stdout: "ignore",
          stderr: "ignore",
          env: { ...process.env, TERM: "dumb" },
        });

        registerProcess(proc.pid, command, port, proc);

        return {
          success: true,
          pid: proc.pid,
          message: `Command started in the background (${shell.name}). PID: ${proc.pid}`,
        };
      }

      const proc = Bun.spawn(spawnArgs, {
        cwd: executionRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, TERM: "dumb" },
      });
      const timer = setTimeout(() => proc.kill(), timeout);
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);
      return {
        stdout: truncate(stdout, MAX_OUTPUT),
        stderr: truncate(stderr, MAX_OUTPUT),
        exitCode,
      };
    }
    case "webSearch": {
      const { query, maxResults } = toolInputSchemas.webSearch.parse(input);
      const res = await apiClient.web.search.$post({
        json: { query, maxResults },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Web search failed: ${text}`);
      }
      return await res.json();
    }
    case "webFetch": {
      const { url, maxLength } = toolInputSchemas.webFetch.parse(input);
      const res = await apiClient.web.fetch.$post({
        json: { url, maxLength },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Web fetch failed: ${text}`);
      }
      return await res.json();
    }
    case "gitStatus": {
      const res = spawnSync("git", ["status", "--short"], {
        cwd: executionRoot,
        encoding: "utf-8",
      });
      return {
        status: res.stdout || res.stderr || "",
        exitCode: res.status,
      };
    }
    case "gitDiff": {
      const { path: diffPath } = toolInputSchemas.gitDiff.parse(input);
      const args = ["diff"];
      if (diffPath) {
        const { cwd, resolved } = resolveInsideRoot(executionRoot, diffPath);
        args.push("--", relative(cwd, resolved));
      }
      const res = spawnSync("git", args, {
        cwd: executionRoot,
        encoding: "utf-8",
      });
      return {
        diff: res.stdout || res.stderr || "",
        exitCode: res.status,
      };
    }
    case "gitLog": {
      const { limit } = toolInputSchemas.gitLog.parse(input);
      const res = spawnSync("git", ["log", `-${limit}`, "--oneline"], {
        cwd: executionRoot,
        encoding: "utf-8",
      });
      return {
        log: res.stdout || res.stderr || "",
        exitCode: res.status,
      };
    }
    case "skill": {
      const { name, arguments: args } = toolInputSchemas.skill.parse(input);
      const { loadSkill } = await import("../context/skills");
      const skill = loadSkill(name, executionRoot);
      if (!skill) {
        return {
          found: false,
          error: `No skill named "${name}". Check the Available Skills index in the system prompt for the exact name.`,
        };
      }
      if (skill.disableModelInvocation) {
        return {
          found: false,
          error: `Skill "${name}" is user-only and cannot be invoked by the model.`,
        };
      }
      let bodyText = skill.body;
      if (skill.getDynamicBody) {
        try {
          bodyText = await skill.getDynamicBody(args ?? "", sId);
        } catch (err) {
          console.error(`Failed to resolve dynamic body for skill ${name}:`, err);
        }
      }
      return {
        found: true,
        name: skill.name,
        description: skill.description,
        arguments: args ?? null,
        instructions: bodyText,
      };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export async function executeLocalTool(
  toolName: string,
  input: unknown,
  mode: ModeType,
  sessionId?: string,
) {
  const sId = sessionId ?? "default";

  // PreToolUse hooks — can block execution
  const preResult = await runPreToolHooks(toolName, input, sId);
  if (preResult.blocked) {
    throw new Error(
      preResult.reason
        ? `Hook blocked tool ${toolName}: ${preResult.reason}`
        : `Hook blocked tool ${toolName}`,
    );
  }

  let output: unknown;
  try {
    output = await executeLocalToolImpl(toolName, input, mode, sessionId);
  } catch (err) {
    // PostToolUseFailure hooks — best-effort, don't rethrow
    void runPostToolUseFailureHooks(
      toolName,
      input,
      err instanceof Error ? err.message : String(err),
      sId,
    );
    throw err;
  }

  // PostToolUse hooks — fire-and-forget so tool output is returned immediately
  void runPostToolHooks(toolName, input, output, sId);
  return output;
}

export function getSessionModifiedFiles(sessionId: string): string[] {
  const sessionContents = sessionOriginalContents.get(sessionId);
  if (!sessionContents) return [];
  const cwd = process.cwd();
  return Array.from(sessionContents.keys()).map((p) => relative(cwd, p));
}
