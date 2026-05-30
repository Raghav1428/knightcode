import { asc, eq, max, sql } from "drizzle-orm";
import type { Store } from "./client";
import { messageTable, sessionTable, type MessageRow } from "./schema";

export interface AppendMessageInput {
  id: string;
  sessionId: string;
  role: string;
  parts: unknown[];
  metadata?: Record<string, unknown> | null;
  status?: string;
  timeStarted?: number | null;
  timeCompleted?: number | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

function nextOrd(db: Store, sessionId: string): number {
  const row = db
    .select({ value: max(messageTable.ord) })
    .from(messageTable)
    .where(eq(messageTable.sessionId, sessionId))
    .get();
  return (row?.value ?? 0) + 1;
}

export function appendMessage(db: Store, input: AppendMessageInput): MessageRow {
  const row: MessageRow = {
    id: input.id,
    sessionId: input.sessionId,
    role: input.role,
    parts: input.parts,
    metadata: input.metadata ?? null,
    status: input.status ?? "complete",
    ord: nextOrd(db, input.sessionId),
    timeStarted: input.timeStarted ?? null,
    timeCompleted: input.timeCompleted ?? null,
    durationMs: input.durationMs ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
  };
  db.insert(messageTable).values(row).run();
  db.update(sessionTable)
    .set({ timeUpdated: Date.now() })
    .where(eq(sessionTable.id, input.sessionId))
    .run();
  return row;
}

export interface UpdateMessagePatch {
  parts?: unknown[];
  metadata?: Record<string, unknown> | null;
  status?: string;
  timeCompleted?: number | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export function updateMessage(
  db: Store,
  id: string,
  patch: UpdateMessagePatch,
): void {
  db.update(messageTable).set(patch).where(eq(messageTable.id, id)).run();
}

export function getMessages(db: Store, sessionId: string): MessageRow[] {
  return db
    .select()
    .from(messageTable)
    .where(eq(messageTable.sessionId, sessionId))
    .orderBy(asc(messageTable.ord))
    .all();
}

export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
}

export function sessionUsage(db: Store, sessionId: string): SessionUsage {
  const row = db
    .select({
      inputTokens: sql<number>`coalesce(sum(${messageTable.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${messageTable.outputTokens}), 0)`,
      messageCount: sql<number>`count(*)`,
    })
    .from(messageTable)
    .where(eq(messageTable.sessionId, sessionId))
    .get();
  return {
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: row?.outputTokens ?? 0,
    messageCount: row?.messageCount ?? 0,
  };
}
