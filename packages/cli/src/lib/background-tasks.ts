import { spawnSync, execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROCESSES_FILE = path.join(process.cwd(), ".knightcode", "processes.json");
const activeProcesses = new Map<number, any>();

export function killProcessOnPort(port: number) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf-8" });
      const lines = output.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0" && pid !== String(process.pid)) {
          execSync(`taskkill /F /PID ${pid}`);
        }
      }
    } else {
      const output = execSync(`lsof -t -i:${port}`, { encoding: "utf-8" });
      const pids = output.trim().split("\n");
      for (const pid of pids) {
        if (pid && pid !== String(process.pid)) {
          execSync(`kill -9 ${pid}`);
        }
      }
    }
  } catch {
    // Port wasn't occupied or error
  }
}

export interface BackgroundProcess {
  pid: number;
  command: string;
  port?: number;
  startedAt: string;
  status: "running" | "stopped";
}

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadRegistry(): Record<string, BackgroundProcess> {
  try {
    if (fs.existsSync(PROCESSES_FILE)) {
      return JSON.parse(fs.readFileSync(PROCESSES_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

export function saveRegistry(registry: Record<string, BackgroundProcess>) {
  try {
    ensureDirExists(PROCESSES_FILE);
    fs.writeFileSync(PROCESSES_FILE, JSON.stringify(registry, null, 2), "utf-8");
  } catch {}
}

export function registerProcess(pid: number, command: string, port?: number, proc?: any) {
  const registry = loadRegistry();
  registry[pid] = {
    pid,
    command,
    port,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  saveRegistry(registry);
  if (proc) {
    activeProcesses.set(pid, proc);
  }
}

export function unregisterProcess(pid: number) {
  const registry = loadRegistry();
  delete registry[pid];
  saveRegistry(registry);
  activeProcesses.delete(pid);
}

export function monitorProcessesHeartbeat() {
  const registry = loadRegistry();
  let changed = false;

  for (const pidStr of Object.keys(registry)) {
    const pid = parseInt(pidStr, 10);
    let isAlive = false;

    try {
      process.kill(pid, 0);
      isAlive = true;
    } catch {
      isAlive = false;
    }

    if (!isAlive) {
      delete registry[pidStr];
      activeProcesses.delete(pid);
      changed = true;
    }
  }

  if (changed) {
    saveRegistry(registry);
  }
}

export function cleanupAllProcesses() {
  const registry = loadRegistry();
  for (const pidStr of Object.keys(registry)) {
    const pid = parseInt(pidStr, 10);
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid}`);
      } else {
        process.kill(pid, "SIGTERM");
      }
    } catch {}

    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /PID ${pid}`);
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch {}
    unregisterProcess(pid);
  }
}
