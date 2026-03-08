import os from "os";
import { execSync } from "child_process";
import type { SystemInfo, DiskUsage, ToolResult } from "../types/index.js";

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(2)} ${units[unit]}`;
}

export function getSystemInfo(): SystemInfo {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    nodeVersion: process.version,
  };
}

export function formatSystemInfo(info: SystemInfo): string {
  const usedMemory = info.totalMemory - info.freeMemory;
  const memPercent = ((usedMemory / info.totalMemory) * 100).toFixed(1);
  const uptimeHours = (info.uptime / 3600).toFixed(1);

  return [
    `Platform   : ${info.platform} (${info.arch})`,
    `Hostname   : ${info.hostname}`,
    `Memory     : ${formatBytes(usedMemory)} used / ${formatBytes(info.totalMemory)} total (${memPercent}%)`,
    `Free Memory: ${formatBytes(info.freeMemory)}`,
    `Uptime     : ${uptimeHours} hours`,
    `Node.js    : ${info.nodeVersion}`,
  ].join("\n");
}

function parseDfOutput(raw: string): DiskUsage[] {
  const lines = raw.trim().split("\n").slice(1); // skip header
  const results: DiskUsage[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);

    if (parts.length >= 6) {
      // Linux/macOS: Filesystem, Size, Used, Avail, Use%, Mounted
      results.push({
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mountpoint: parts.slice(5).join(" "),
      });
    }
  }

  return results;
}

export function getDiskUsage(): ToolResult {
  try {
    const platform = os.platform();
    let raw: string;

    if (platform === "win32") {
      // Windows: use wmic
      raw = execSync(
        "wmic logicaldisk get size,freespace,caption",
        { encoding: "utf-8", timeout: 10_000 }
      );

      const lines = raw.trim().split("\n").slice(1);
      const output = lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const drive = parts[0];
            const free = parseInt(parts[1] ?? "0", 10);
            const total = parseInt(parts[2] ?? "0", 10);
            const used = total - free;
            const percent = total > 0 ? ((used / total) * 100).toFixed(1) : "0";
            return `Drive ${drive}: ${formatBytes(used)} used / ${formatBytes(total)} total (${percent}% used), ${formatBytes(free)} free`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");

      return { success: true, output: output || "No drives found" };
    } else {
      // macOS/Linux
      raw = execSync("df -h", { encoding: "utf-8", timeout: 10_000 });
      const disks = parseDfOutput(raw);

      if (disks.length === 0) {
        return { success: true, output: "No disk information available" };
      }

      const output = disks
        .map(
          (d) =>
            `${d.filesystem} → ${d.used} used / ${d.size} total (${d.usePercent} used), ${d.available} free — mounted at ${d.mountpoint}`
        )
        .join("\n");

      return { success: true, output };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export function getEnvironmentVariables(filter?: string): ToolResult {
  const env = process.env;
  const entries = Object.entries(env);

  const filtered = filter
    ? entries.filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  if (filtered.length === 0) {
    return { success: true, output: "(no matching environment variables)" };
  }

  const output = filtered
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");

  return { success: true, output };
}
