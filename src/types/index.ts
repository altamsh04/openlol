export interface ServerConfig {
  folderPath: string;
  port: number;
  sessionToken: string;
  host: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface CommandExecutionOptions {
  command: string;
  cwd: string;
  timeout?: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  nodeVersion: string;
}

export interface DiskUsage {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usePercent: string;
  mountpoint: string;
}
