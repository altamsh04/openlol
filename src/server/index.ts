import http from "http";
import type { ServerConfig } from "../types/index.js";
import { createHttpServer } from "./http.js";

export interface RunningServer {
  httpServer: http.Server;
  stop: () => Promise<void>;
}

/**
 * Bootstraps the HTTP + MCP layer, then starts listening.
 * MCP server instances are created per-connection inside the HTTP layer.
 */
export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const app = createHttpServer(config);
  const httpServer = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(config.port, config.host, resolve);
  });

  const stop = (): Promise<void> =>
    new Promise((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  return { httpServer, stop };
}
