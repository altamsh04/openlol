import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { v4 as uuidv4 } from "uuid";
import { createMcpServer } from "./mcp.js";
import type { ServerConfig } from "../types/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SseSession {
  transport: SSEServerTransport;
}

interface StreamableSession {
  transport: StreamableHTTPServerTransport;
}

// ─── Session stores ───────────────────────────────────────────────────────────

/** SSE sessions: sessionId → transport */
const sseSessions = new Map<string, SseSession>();

/** Streamable HTTP sessions: mcp-session-id header → transport+server */
const streamableSessions = new Map<string, StreamableSession>();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authMiddleware(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization ?? "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const queryToken = (req.query.token as string | undefined) ?? null;
    const token = bearerToken ?? queryToken;

    if (token !== expectedToken) {
      res.status(401).json({ error: "Unauthorized: invalid or missing token" });
      return;
    }

    next();
  };
}

// ─── HTTP server factory ──────────────────────────────────────────────────────

export function createHttpServer(config: ServerConfig): express.Application {
  const app = express();

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id"],
      exposedHeaders: ["mcp-session-id"],
    })
  );

  app.use(express.json({ limit: "10mb" }));

  // ── Health check (public) ────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "openlol",
      version: "1.0.0",
      folder: config.folderPath,
      sseSessions: sseSessions.size,
      streamableSessions: streamableSessions.size,
    });
  });

  // ── Streamable HTTP transport — POST /mcp (protected) ────────────────────
  // Claude Desktop and modern MCP clients try this first.
  // Each logical client session gets its own transport+server pair.
  app.post(
    "/mcp",
    authMiddleware(config.sessionToken),
    async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId) {
          // Resume existing session
          const session = streamableSessions.get(sessionId);
          if (!session) {
            res.status(404).json({ error: `Session not found: ${sessionId}` });
            return;
          }
          await session.transport.handleRequest(req, res, req.body);
          return;
        }

        // New session — create a fresh transport + MCP server pair
        const newSessionId = uuidv4();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });

        const mcpServer = createMcpServer(config.folderPath);
        streamableSessions.set(newSessionId, { transport });

        transport.onclose = () => {
          streamableSessions.delete(newSessionId);
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("[openlol] Streamable HTTP error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  );

  // GET /mcp — required for streamable HTTP GET SSE streams
  app.get(
    "/mcp",
    authMiddleware(config.sessionToken),
    async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: "Missing mcp-session-id header" });
        return;
      }
      const session = streamableSessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: `Session not found: ${sessionId}` });
        return;
      }
      try {
        await session.transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("[openlol] Streamable HTTP GET error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // DELETE /mcp — session termination
  app.delete(
    "/mcp",
    authMiddleware(config.sessionToken),
    async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId) {
        const session = streamableSessions.get(sessionId);
        if (session) {
          await session.transport.handleRequest(req, res, req.body);
          streamableSessions.delete(sessionId);
          return;
        }
      }
      res.status(404).json({ error: "Session not found" });
    }
  );

  // ── Legacy SSE transport — GET /sse (protected) ──────────────────────────
  // Kept for backwards-compatibility and clients that only support SSE.
  // Each connection gets its own MCP server instance to allow multiple clients.
  app.get(
    "/sse",
    authMiddleware(config.sessionToken),
    async (_req: Request, res: Response) => {
      try {
        const transport = new SSEServerTransport("/messages", res);
        const sessionId = transport.sessionId;

        const mcpServer = createMcpServer(config.folderPath);
        sseSessions.set(sessionId, { transport });

        res.on("close", () => {
          sseSessions.delete(sessionId);
        });

        await mcpServer.connect(transport);
      } catch (err) {
        console.error("[openlol] SSE connection error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to establish SSE connection" });
        }
      }
    }
  );

  // POST /messages — SSE message relay (protected)
  app.post(
    "/messages",
    authMiddleware(config.sessionToken),
    async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string | undefined;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId query parameter" });
        return;
      }

      const session = sseSessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          error: `SSE session not found: ${sessionId}. Reconnect to /sse.`,
        });
        return;
      }

      try {
        await session.transport.handlePostMessage(req, res, req.body);
      } catch (err) {
        console.error("[openlol] SSE message error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to process message" });
        }
      }
    }
  );

  // ── Catch-all ────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
