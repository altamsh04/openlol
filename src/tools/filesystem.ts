import fs from "fs/promises";
import { existsSync, statSync } from "fs";
import path from "path";
import { assertWithinRoot } from "./terminal.js";
import type { ToolResult } from "../types/index.js";

/**
 * Resolves and validates a path within the root folder.
 * Returns the absolute path or throws if access is denied.
 */
function safeResolve(relativePath: string, rootFolder: string): string {
  const resolved = path.resolve(rootFolder, relativePath);
  assertWithinRoot(relativePath, rootFolder);
  return resolved;
}

export async function readFile(
  filePath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(filePath, rootFolder);
    const content = await fs.readFile(absPath, "utf-8");
    return { success: true, output: content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function writeFile(
  filePath: string,
  content: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(filePath, rootFolder);

    // Create parent directories if they don't exist
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, "utf-8");

    return { success: true, output: `File written: ${absPath}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function appendFile(
  filePath: string,
  content: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(filePath, rootFolder);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.appendFile(absPath, content, "utf-8");
    return { success: true, output: `Content appended to: ${absPath}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function deleteFile(
  filePath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(filePath, rootFolder);
    await fs.rm(absPath, { recursive: true, force: true });
    return { success: true, output: `Deleted: ${absPath}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function listDirectory(
  dirPath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(dirPath, rootFolder);
    const entries = await fs.readdir(absPath, { withFileTypes: true });

    const lines = entries.map((e) => {
      const type = e.isDirectory() ? "DIR " : "FILE";
      return `[${type}] ${e.name}`;
    });

    const output =
      lines.length > 0
        ? lines.join("\n")
        : "(directory is empty)";

    return { success: true, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function createDirectory(
  dirPath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(dirPath, rootFolder);
    await fs.mkdir(absPath, { recursive: true });
    return { success: true, output: `Directory created: ${absPath}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function moveFile(
  sourcePath: string,
  destinationPath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absSource = safeResolve(sourcePath, rootFolder);
    const absDest = safeResolve(destinationPath, rootFolder);
    await fs.mkdir(path.dirname(absDest), { recursive: true });
    await fs.rename(absSource, absDest);
    return { success: true, output: `Moved: ${absSource} → ${absDest}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}

export async function fileExists(
  filePath: string,
  rootFolder: string
): Promise<ToolResult> {
  try {
    const absPath = safeResolve(filePath, rootFolder);
    const exists = existsSync(absPath);

    if (!exists) {
      return { success: true, output: `Path does not exist: ${absPath}` };
    }

    const stat = statSync(absPath);
    const type = stat.isDirectory() ? "directory" : "file";
    const size = stat.isFile() ? ` (${stat.size} bytes)` : "";

    return {
      success: true,
      output: `${type} exists: ${absPath}${size}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: "", error: message };
  }
}
