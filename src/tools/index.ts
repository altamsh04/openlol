import { z } from "zod";
import { executeCommand } from "./terminal.js";
import {
  readFile,
  writeFile,
  appendFile,
  deleteFile,
  listDirectory,
  createDirectory,
  moveFile,
  fileExists,
} from "./filesystem.js";
import {
  getSystemInfo,
  formatSystemInfo,
  getDiskUsage,
  getEnvironmentVariables,
} from "./system.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "execute_command",
    description:
      "Execute a terminal/shell command in the scoped working directory. Use this for any system operation, file manipulation, or running scripts. Commands run in the folder specified when the server started.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "The shell command to execute (e.g. 'ls -la', 'cat file.txt', 'npm install')",
        },
        timeout: {
          type: "number",
          description:
            "Optional timeout in milliseconds (default: 30000, max: 120000)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file within the scoped folder. Returns the full text content.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Relative path to the file from the root folder (e.g. 'README.md', 'src/index.ts')",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a file with the given content. Creates parent directories automatically.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file from the root folder",
        },
        content: {
          type: "string",
          description: "The full content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "append_file",
    description:
      "Append content to the end of an existing file (or create it if it doesn't exist).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file from the root folder",
        },
        content: {
          type: "string",
          description: "The content to append",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description:
      "Delete a file or directory (recursively) within the scoped folder.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file or directory to delete",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description:
      "List the contents of a directory within the scoped folder. Shows files and subdirectories.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Relative path to the directory (use '.' for the root folder)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "create_directory",
    description:
      "Create a directory (and any missing parent directories) within the scoped folder.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path of the directory to create",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "move_file",
    description:
      "Move or rename a file/directory within the scoped folder.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Relative path to the source file/directory",
        },
        destination: {
          type: "string",
          description: "Relative path to the destination",
        },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "file_exists",
    description:
      "Check whether a file or directory exists within the scoped folder.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to check",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "get_system_info",
    description:
      "Get information about the host machine: OS, architecture, memory usage, uptime, and Node version.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_disk_usage",
    description:
      "Get disk/storage usage for all mounted drives or partitions on the machine.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_environment_variables",
    description:
      "List environment variables available to the server process. Optionally filter by name.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Optional case-insensitive substring to filter variable names (e.g. 'PATH', 'NODE')",
        },
      },
    },
  },
];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const ExecuteCommandSchema = z.object({
  command: z.string().min(1),
  timeout: z.number().min(1).max(120_000).optional(),
});

const PathSchema = z.object({ path: z.string().min(1) });

const WriteFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const MoveFileSchema = z.object({
  source: z.string().min(1),
  destination: z.string().min(1),
});

const EnvVarsSchema = z.object({ filter: z.string().optional() });

// ─── Tool Dispatcher ─────────────────────────────────────────────────────────

export async function dispatchTool(
  toolName: string,
  args: unknown,
  rootFolder: string
): Promise<ToolCallResult> {
  const ok = (text: string): ToolCallResult => ({
    content: [{ type: "text", text }],
  });

  const err = (text: string): ToolCallResult => ({
    content: [{ type: "text", text }],
    isError: true,
  });

  try {
    switch (toolName) {
      case "execute_command": {
        const { command, timeout } = ExecuteCommandSchema.parse(args);
        const result = await executeCommand({ command, cwd: rootFolder, timeout });
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "read_file": {
        const { path } = PathSchema.parse(args);
        const result = await readFile(path, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "write_file": {
        const { path, content } = WriteFileSchema.parse(args);
        const result = await writeFile(path, content, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "append_file": {
        const { path, content } = WriteFileSchema.parse(args);
        const result = await appendFile(path, content, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "delete_file": {
        const { path } = PathSchema.parse(args);
        const result = await deleteFile(path, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "list_directory": {
        const { path } = PathSchema.parse(args);
        const result = await listDirectory(path, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "create_directory": {
        const { path } = PathSchema.parse(args);
        const result = await createDirectory(path, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "move_file": {
        const { source, destination } = MoveFileSchema.parse(args);
        const result = await moveFile(source, destination, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "file_exists": {
        const { path } = PathSchema.parse(args);
        const result = await fileExists(path, rootFolder);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "get_system_info": {
        const info = getSystemInfo();
        return ok(formatSystemInfo(info));
      }

      case "get_disk_usage": {
        const result = getDiskUsage();
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      case "get_environment_variables": {
        const { filter } = EnvVarsSchema.parse(args ?? {});
        const result = getEnvironmentVariables(filter);
        return result.success ? ok(result.output) : err(result.error ?? result.output);
      }

      default:
        return err(`Unknown tool: "${toolName}"`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return err(`Invalid arguments: ${e.errors.map((x) => x.message).join(", ")}`);
    }
    const message = e instanceof Error ? e.message : String(e);
    return err(`Tool error: ${message}`);
  }
}
