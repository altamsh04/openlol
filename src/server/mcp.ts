import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, dispatchTool } from "../tools/index.js";

/**
 * Creates and configures the MCP server with all tool handlers.
 * The server is transport-agnostic and can be connected to any MCP transport.
 */
export function createMcpServer(rootFolder: string): Server {
  const server = new Server(
    {
      name: "openlol",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Execute tool calls — cast to `any` to avoid SDK version type drift
  // The runtime shape is valid per the MCP spec (content array + optional isError)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, args ?? {}, rootFolder);
  });

  return server;
}
