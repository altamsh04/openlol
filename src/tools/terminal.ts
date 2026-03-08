import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import type { CommandExecutionOptions, ToolResult } from "../types/index.js";

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Validates that a given path stays within the allowed root folder.
 * Prevents directory traversal attacks.
 */
export function assertWithinRoot(targetPath: string, rootFolder: string): void {
  const resolved = path.resolve(rootFolder, targetPath);
  const root = path.resolve(rootFolder);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `Access denied: path "${targetPath}" is outside the allowed folder.`
    );
  }
}

/**
 * Executes a shell command within the scoped working directory.
 */
export async function executeCommand(
  options: CommandExecutionOptions
): Promise<ToolResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await execAsync(options.command, {
      cwd: options.cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: {
        ...process.env,
        // Ensure PATH is available for common tools
        PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      },
    });

    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    return {
      success: true,
      output: output || "(command completed with no output)",
    };
  } catch (err) {
    const error = err as { message: string; stdout?: string; stderr?: string; killed?: boolean };

    if (error.killed) {
      return {
        success: false,
        output: "",
        error: `Command timed out after ${timeout / 1000}s: ${options.command}`,
      };
    }

    const detail = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n")
      .trim();

    return {
      success: false,
      output: "",
      error: detail || "Unknown error occurred",
    };
  }
}
