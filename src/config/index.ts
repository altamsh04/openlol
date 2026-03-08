import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import type { ServerConfig } from "../types/index.js";

const DEFAULT_PORT = 3333;
const DEFAULT_HOST = "localhost";

export function resolveFolder(folderPath: string): string {
  const resolved = path.resolve(folderPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Folder does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  return resolved;
}

export function buildServerConfig(options: {
  folderPath: string;
  port?: number;
  host?: string;
}): ServerConfig {
  const folderPath = resolveFolder(options.folderPath);
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const sessionToken = uuidv4();

  return { folderPath, port, host, sessionToken };
}
