#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { buildServerConfig } from "./config/index.js";
import { startServer } from "./server/index.js";

const pkg = {
  name: "openlol",
  version: "1.1.2",
  description: "Local MCP server — give AI agents access to your machine",
};

// ─── Banner ──────────────────────────────────────────────────────────────────

function printBanner(): void {
  const C = chalk.bold.cyan;
  console.log();
  console.log(C("   ██████╗ ██████╗ ███████╗███╗   ██╗██╗      ██████╗ ██╗"));
  console.log(C("  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██║     ██╔═══██╗██║"));
  console.log(C("  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║   ██║██║"));
  console.log(C("  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║   ██║██║"));
  console.log(C("  ╚██████╔╝██║     ███████╗██║ ╚████║███████╗╚██████╔╝███████╗"));
  console.log(C("   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚══════╝"));
  console.log();
  console.log(
    "  " + chalk.bold.white("Your machine, as an MCP server.") +
    "  " + chalk.dim(`v${pkg.version}`)
  );
  console.log();
}

// ─── Connection info ──────────────────────────────────────────────────────────

function printConnectionInfo(opts: {
  host: string;
  port: number;
  token: string;
  folder: string;
}): void {
  const base   = `http://${opts.host}:${opts.port}`;
  const mcpUrl = `${base}/mcp?token=${opts.token}`;
  const sseUrl = `${base}/sse?token=${opts.token}`;

  console.log(chalk.bold("  Status  ") + chalk.green("● running"));
  console.log(chalk.bold("  Folder  ") + chalk.yellow(opts.folder));
  console.log(chalk.bold("  Token   ") + chalk.magenta(opts.token));
  console.log();
  console.log(chalk.bold.white("  ─── Add to your AI client ───────────────────────"));
  console.log();
  console.log(chalk.bold("  Primary URL") + chalk.dim(" (Streamable HTTP — Claude Desktop, Cursor, etc.):"));
  console.log("  " + chalk.cyan.underline(mcpUrl));
  console.log();
  console.log(chalk.bold("  Fallback URL") + chalk.dim(" (SSE — legacy clients):"));
  console.log("  " + chalk.cyan.underline(sseUrl));
  console.log();
  console.log(chalk.bold("  Health check:"));
  console.log("  " + chalk.cyan.underline(`${base}/health`));
  console.log();
  console.log(chalk.bold.white("  ─── Cursor config (.cursor/mcp.json) ───────────────────"));
  console.log();
  console.log(
    chalk.gray(
      JSON.stringify(
        { mcpServers: { openlol: { url: mcpUrl, transport: "http" } } },
        null,
        4
      )
        .split("\n")
        .map((l) => "  " + l)
        .join("\n")
    )
  );
  console.log();
  console.log(chalk.dim("  Press Ctrl+C to stop the server."));
  console.log();
  console.log(chalk.dim("  ─── Logs ") + chalk.dim("─".repeat(44)));
  console.log();
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name(pkg.name)
  .version(pkg.version)
  .description(pkg.description)
  .argument("[path]", "Folder to expose (defaults to current directory)")
  .option(
    "-f, --folder <path>",
    "Folder to expose to AI agents (alternative to positional argument)"
  )
  .option(
    "-p, --port <number>",
    "Port to listen on (default: 3333)",
    (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 65535) {
        console.error(chalk.red(`Invalid port: ${v}`));
        process.exit(1);
      }
      return n;
    }
  )
  .option("--host <host>", "Host to bind to (default: localhost)", "localhost")
  .action(async (arg, options) => {
    printBanner();

    // Resolution order: positional arg → -f flag → current directory
    const folderPath = arg ?? options.folder ?? process.cwd();

    let config;
    try {
      config = buildServerConfig({
        folderPath,
        port: options.port,
        host: options.host,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  Error: ${message}`));
      process.exit(1);
    }

    let server;
    try {
      server = await startServer(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  Failed to start server: ${message}`));
      process.exit(1);
    }

    printConnectionInfo({
      host: config.host,
      port: config.port,
      token: config.sessionToken,
      folder: config.folderPath,
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log();
      console.log(chalk.dim(`  Received ${signal}. Shutting down...`));
      try {
        await server.stop();
        console.log(chalk.dim("  Server stopped. Goodbye."));
      } catch {
        // ignore cleanup errors
      }
      process.exit(0);
    };

    process.on("SIGINT",  () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  });

program.parse(process.argv);
