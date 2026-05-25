import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface PermissionsSchema {
  allowedCommands: string[];
}

function getPermissionsPath(): string {
  return join(homedir(), ".knightcode", "permissions.json");
}

export function loadPermissions(): PermissionsSchema {
  const filePath = getPermissionsPath();
  if (!existsSync(filePath)) {
    return { allowedCommands: [] };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { allowedCommands: [] };
  }
}

export function savePermissions(permissions: PermissionsSchema): void {
  const filePath = getPermissionsPath();
  const dir = join(homedir(), ".knightcode");
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(permissions, null, 2), "utf-8");
  } catch {}
}

export function isCommandAllowed(command: string): boolean {
  const permissions = loadPermissions();
  // Check if command starts with any allowed command prefix
  return permissions.allowedCommands.some((allowed) => {
    return command.trim().startsWith(allowed.trim());
  });
}

export function allowCommand(commandPattern: string): void {
  const permissions = loadPermissions();
  const pattern = commandPattern.trim();
  if (!permissions.allowedCommands.includes(pattern)) {
    permissions.allowedCommands.push(pattern);
    savePermissions(permissions);
  }
}
