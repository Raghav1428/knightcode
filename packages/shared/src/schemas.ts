import { z } from "zod";
import { tool } from "ai";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read"),
    offset: z
      .int()
      .min(0)
      .optional()
      .describe("Starting line number (0-indexed) for paginated reading"),
    limit: z
      .int()
      .min(1)
      .optional()
      .describe("Maximum number of lines to return (default 200)"),
  }),
  listDirectory: z.object({
    path: z.string().default(".").describe("Relative directory path to list"),
  }),
  glob: z.object({
    pattern: z.string().describe("Glob pattern to match files"),
    path: z.string().default(".").describe("Directory to search from"),
  }),
  grep: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().default(".").describe("Directory to search from"),
    include: z
      .string()
      .optional()
      .describe("Optional glob for files to include, e.g. '*.ts'"),
    caseInsensitive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Case insensitive search"),
    contextLines: z
      .number()
      .optional()
      .describe("Lines of context around each match (before and after)"),
    outputMode: z
      .enum(["content", "files", "count"])
      .optional()
      .default("content")
      .describe(
        "'content' shows matching lines, 'files' lists filenames, 'count' shows match counts",
      ),
    maxResults: z
      .number()
      .optional()
      .default(200)
      .describe("Max results to return (default 200)"),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to write"),
    content: z.string().describe("File contents"),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to edit"),
    oldString: z
      .string()
      .min(1)
      .describe(
        "Exact text to replace; must be unique unless replaceAll is true",
      ),
    newString: z.string().describe("Replacement text"),
    replaceAll: z
      .boolean()
      .optional()
      .default(false)
      .describe("Replace all occurrences"),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to run"),
    description: z
      .string()
      .optional()
      .describe("Short description of the command"),
    timeout: z.int().min(1).optional().describe("Timeout in milliseconds"),
    runInBackground: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to run the command in the background"),
    port: z
      .int()
      .min(1)
      .max(65535)
      .optional()
      .describe(
        "Optional port that this command binds to. If occupied, port check will free it or fail.",
      ),
  }),
  webSearch: z.object({
    query: z.string().describe("Search query to run on the web"),
    maxResults: z
      .int()
      .min(0)
      .max(20)
      .optional()
      .default(5)
      .describe(
        "Maximum number of search results to return (default 5, max 20)",
      ),
  }),
  todoWrite: z.object({
    items: z
      .array(
        z.object({
          id: z.string().describe("Unique ID for this todo item"),
          label: z.string().describe("Short label describing the task"),
          status: z
            .enum(["pending", "in_progress", "completed"])
            .describe("Current status of the task"),
        }),
      )
      .describe("List of progress items to display"),
  }),
  webFetch: z.object({
    url: z.url().describe("URL to fetch and convert to text"),
    maxLength: z
      .int()
      .min(1)
      .max(200_000)
      .optional()
      .default(20000)
      .describe("Maximum character length of returned text (default 20000)"),
  }),
  AskUserQuestion: z.object({
    question: z.string().describe("The main question to ask the user"),
    options: z
      .array(z.string())
      .min(2)
      .describe("A list of options to present to the user"),
    isMultiSelect: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether the user can select multiple options (true means checkboxes, false means radio buttons)",
      ),
  }),
  gitStatus: z.object({}),
  gitDiff: z.object({
    path: z
      .string()
      .optional()
      .describe("Optional relative path to restrict the diff to"),
  }),
  gitLog: z.object({
    limit: z
      .int()
      .min(1)
      .optional()
      .default(10)
      .describe("Maximum number of commits to return (default 10)"),
  }),
  skill: z.object({
    name: z
      .string()
      .describe(
        "Name of the skill to load (must match a name from the Available Skills index in the system prompt)",
      ),
    arguments: z
      .string()
      .optional()
      .describe(
        "Optional free-text arguments to pass into the skill. The skill body itself decides how to interpret them.",
      ),
  }),
} as const;

export const readOnlyToolContracts = {
  readFile: tool({
    description: `Read a file from the current project directory. Supports optional line-based pagination via offset and limit.

• Always use this tool to read files — do NOT use bash cat, head, or tail.
• Results include line-number prefixes (N\\t format). Strip the prefix before using content as oldString in editFile.
• For large files use offset + limit to paginate (default 200 lines; increase limit as needed).
• Reading a directory or missing file returns an error — use listDirectory instead.`,
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: `List entries in a directory under the current project directory.

• Always use this tool to inspect directory contents — do NOT run bash ls.
• Use glob for pattern-based file searches across subdirectories.`,
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: `Find files matching a glob pattern under the current project directory.

• ALWAYS use this tool instead of bash find commands.
• Supports patterns like **/*.ts, src/**/*.tsx.
• Returns paths sorted by modification time.
• For content searches use grep instead.`,
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description: `Search file contents with a regular expression under the current project directory.

• ALWAYS use this tool for content searches. NEVER invoke grep, rg, or ripgrep as a bash command.
• Full regex syntax supported. Escape literal braces: interface\\{\\} not interface{}.
• outputMode: "content" — matching lines; "files" — file paths only; "count" — match counts per file.
• Use the include parameter to filter by file glob (e.g. "*.ts").
• Use contextLines to show surrounding lines around each match.
• For broad searches requiring multiple iterations, run multiple grep calls in parallel.`,
    inputSchema: toolInputSchemas.grep,
  }),
  webSearch: tool({
    description: `Search the web for information using Tavily.

• ALWAYS include a "Sources:" section at the end with markdown links [Title](URL) for every result cited.
• Include the current month and year in time-sensitive queries (e.g. "best practices 2026").`,
    inputSchema: toolInputSchemas.webSearch,
  }),
  todoWrite: tool({
    description: `Update the progress checklist displayed to the user.

When to use:
• Task requires 3+ distinct steps
• Complex non-trivial work (multi-file changes, refactors, debugging sessions)
• User provides multiple tasks at once
• After receiving new instructions mid-task — update to reflect new scope
• When starting a task (mark in_progress), after completing it (mark completed)

When NOT to use:
• Single-step tasks completable in one tool call
• Purely conversational or informational exchanges

Rules:
• Only ONE item may be in_progress at a time.
• ONLY mark an item completed when it is FULLY done — not partially. Keep it in_progress if tests are failing or implementation is partial.
• Item labels should be imperative: "Run tests", "Update schema", "Add validation".`,
    inputSchema: toolInputSchemas.todoWrite,
  }),
  webFetch: tool({
    description: `Fetch a web page and return its content as plain text. Useful for reading documentation, articles, and web pages.

• Converts HTML to readable text/markdown automatically.
• For GitHub repos prefer the bash gh CLI over fetching raw URLs.
• Use maxLength to limit response size for large pages.`,
    inputSchema: toolInputSchemas.webFetch,
  }),
  AskUserQuestion: tool({
    description: `Ask the user a clarifying or design question using a multiple-choice prompt with optional write-in answer.

• Users can always select "Other" for free-text input — do not add an "Other" option manually.
• multiSelect: true for non-exclusive choices (checkboxes); false for single choice (radio).
• Put the recommended option first and append "(Recommended)" to its label.
• Reserve for decisions where the answer changes what you do next — not for preferences with an obvious default.
• In PLAN mode: use this to clarify requirements BEFORE finalizing the plan. Do NOT ask "Is this plan okay?" or "Should I proceed?" — those belong in exitPlanMode, not here.`,
    inputSchema: toolInputSchemas.AskUserQuestion,
  }),
  gitStatus: tool({
    description: `Get the status of files in the current git repository.

Always use this tool instead of running bash git status to inspect uncommitted changes.`,
    inputSchema: toolInputSchemas.gitStatus,
  }),
  gitDiff: tool({
    description: `Get git diff showing changes in the repository.

Always use this tool instead of running bash git diff when inspecting changes.`,
    inputSchema: toolInputSchemas.gitDiff,
  }),
  gitLog: tool({
    description: `Show commit logs from the git repository.

Always use this tool instead of running bash git log to inspect commit history.`,
    inputSchema: toolInputSchemas.gitLog,
  }),
  skill: tool({
    description: `Load a knightcode skill on demand. The Available Skills section of the system prompt lists every skill name and a one-line description — pick the closest match for what the user is asking and call this tool with that name.

When to use:
• User's request matches a skill description (e.g. user says "review the diff" and there's a "review" skill).
• You need reference instructions that the system prompt summarized but didn't include in full.
• Loading a workflow that takes side-effecting steps (verifying, deploying, releasing).

How to use:
• Pass the EXACT skill name from the index — no slash, no quotes.
• arguments is optional free-text. Most skills don't need it; pass the relevant identifier (issue number, PR number, file path) when the skill calls for one.
• The tool result is the skill's full instructions. After receiving it, FOLLOW the instructions verbatim — they override your default approach.

Do NOT call this tool to discover skills — the index is already in the system prompt. Do NOT call it speculatively for skills whose descriptions don't fit the current task.`,
    inputSchema: toolInputSchemas.skill,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: `Create or overwrite a file under the current project directory.

RULES:
• If the file already exists, you MUST read it with readFile first.
• Prefer editFile for modifying existing files — writeFile sends the entire file content.
• Use writeFile only for new files or complete rewrites.
• NEVER create *.md or README files unless the user explicitly asks for documentation.
• Only use emojis if the user explicitly requests them.`,
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: `Replace exact text in a file under the current project directory.

RULES:
• You MUST call readFile at least once before calling editFile. The edit will fail if you have not read the file.
• oldString must match the file exactly, including all whitespace and indentation. Strip the line-number prefix from readFile output before using as oldString.
• oldString must be unique in the file — add more surrounding lines to make it unique. Use replaceAll: true only when intentionally replacing every occurrence.
• Prefer editFile over writeFile for any modification to existing files.
• Only use emojis if the user explicitly requests them.`,
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: `Run a shell command in the current project directory. The shell is chosen automatically based on the OS (PowerShell on Windows, the user's $SHELL on Unix).

IMPORTANT — Use dedicated tools instead of bash for these operations:
• File search → use the glob tool, NOT find
• Content search → use the grep tool, NOT grep or rg
• Read files → use the readFile tool, NOT cat, head, or tail
• Edit files → use the editFile/writeFile tools, NOT sed or awk
• List directories → use the listDirectory tool, NOT ls

Multiple commands:
• Independent operations → make MULTIPLE separate tool-call invocations in one response (not &&)
• Sequential where order matters → chain with &&
• Sequential where failures are acceptable → chain with ;

Background tasks:
• Use runInBackground: true for servers or long-running processes. You will be notified on completion.
• Never sleep between commands that can run immediately.
• Never start a command with a leading sleep.

Git workflow:
• Never run git commit unless the user explicitly asks you to commit
• Always create new commits (never amend) unless the user explicitly requests an amend
• Never use --force, --no-verify, or --no-gpg-sign unless explicitly requested
• When committing: run git status + git diff in parallel first, then commit with a clear message
• For PRs: run git status + git log + git remote -v in parallel; push with -u; create via gh pr create`,
    inputSchema: toolInputSchemas.bash,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.PLAN ? readOnlyToolContracts : buildToolContracts;
}
