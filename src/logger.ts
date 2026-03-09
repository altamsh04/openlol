import chalk from "chalk";

// ─── Log levels ───────────────────────────────────────────────────────────────

type Level = "info" | "tool" | "error" | "connect" | "disconnect";

const ICONS: Record<Level, string> = {
  connect:    chalk.green("↑"),
  disconnect: chalk.dim("↓"),
  tool:       chalk.cyan("◆"),
  info:       chalk.dim("·"),
  error:      chalk.red("✗"),
};

const LABELS: Record<Level, string> = {
  connect:    chalk.green("connect   "),
  disconnect: chalk.dim("disconnect"),
  tool:       chalk.cyan("tool      "),
  info:       chalk.dim("info      "),
  error:      chalk.red("error     "),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timestamp(): string {
  return chalk.dim(new Date().toTimeString().slice(0, 8));
}

function shortId(id: string): string {
  return chalk.dim(id.slice(0, 8));
}

function truncate(s: string, max = 48): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(level: Level, message: string, detail?: string): void {
  const parts = [
    " ",
    timestamp(),
    " ",
    ICONS[level],
    " ",
    LABELS[level],
    " ",
    message,
    detail ? chalk.dim("  " + detail) : "",
  ];
  console.log(parts.join(""));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  connect(transport: "streamable" | "sse", sessionId: string): void {
    log("connect", chalk.white(transport), shortId(sessionId));
  },

  disconnect(transport: "streamable" | "sse", sessionId: string): void {
    log("disconnect", chalk.dim(transport), shortId(sessionId));
  },

  tool(name: string, args: unknown, success: boolean, output?: string): void {
    const argHint = (() => {
      if (!args || typeof args !== "object") return "";
      const a = args as Record<string, unknown>;
      const first = Object.values(a)[0];
      return first ? truncate(String(first)) : "";
    })();

    const status = success ? chalk.green("ok") : chalk.red("err");
    log(
      "tool",
      `${chalk.white(name.padEnd(26))} ${status}`,
      argHint ? `"${argHint}"` : undefined
    );

    if (!success && output) {
      log("error", chalk.dim(truncate(output, 72)));
    }
  },

  error(context: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    log("error", chalk.dim(context), truncate(message, 60));
  },

  info(message: string): void {
    log("info", chalk.dim(message));
  },
};
