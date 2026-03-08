# OpenLoL 😆

> Open Local Operations Layer — Give any AI agent direct safe access to your machine terminal.

**Status: Under active development. Not yet published to npm.**

---

## What it does

`OpenLoL` starts a local [Model Context Protocol](https://modelcontextprotocol.io) server scoped to a folder on your machine. Point any MCP-compatible AI client at the generated URL and it can read files, write files, run terminal commands, and inspect system info — all within the boundary you define.

No cloud. No relay. Your machine, your folder, your token.

---

## Quick start

```bash
# Clone and install
git clone https://github.com/altamsh04/openlol
cd openlol && npm install && npm run build && npm link

# Start the server
openlol -f /path/to/your/folder
```

---

## CLI options


| Flag                  | Description                     | Default     |
| --------------------- | ------------------------------- | ----------- |
| `-f, --folder <path>` | Folder to expose **(required)** | —           |
| `-p, --port <number>` | Port to listen on               | `3333`      |
| `--host <host>`       | Host to bind to                 | `localhost` |


---

## Connecting to Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "openlol": {
      "url": "http://localhost:3333/mcp?token=<your-token>",
      "transport": "http"
    }
  }
}
```

The token is printed on every server start. A fresh token is generated each time.

---

## Available tools


| Tool                        | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `execute_command`           | Run any shell command inside the scoped folder |
| `read_file`                 | Read a file's contents                         |
| `write_file`                | Create or overwrite a file                     |
| `append_file`               | Append content to a file                       |
| `delete_file`               | Delete a file or directory                     |
| `list_directory`            | List files and folders                         |
| `create_directory`          | Create a directory (recursive)                 |
| `move_file`                 | Move or rename a file                          |
| `file_exists`               | Check if a path exists                         |
| `get_system_info`           | OS, memory, uptime                             |
| `get_disk_usage`            | Storage usage across all drives                |
| `get_environment_variables` | Inspect env vars (with optional filter)        |


All file and command operations are **sandboxed to the folder you specify**. Directory traversal is blocked.

---

## Use cases

**File and project management**

> *"Create a `ideas.md` file and add 10 SaaS startup ideas to it."*
> *"Rename all `.txt` files in this folder to `.md`."*
> *"Show me the folder structure of this project."*

**System inspection**

> *"How much storage is remaining on my laptop?"*
> *"What's my current memory usage?"*
> *"List all environment variables that contain the word PATH."*

**Development workflows**

> *"Run `npm install` and then `npm run build` and show me the output."*
> *"Check if `package.json` exists, then read it and summarize the dependencies."*
> *"Create a new `src/utils` folder and scaffold a `helpers.ts` file."*

**Scripting and automation**

> *"Write a shell script that backs up all `.json` files to a `backup/` subfolder and run it."*
> *"Run `git status` and tell me what files have changed."*

---

## Security model

- Every request to `/mcp` and `/sse` requires the session token (Bearer header or `?token=` query param).
- All file and command operations are restricted to the folder passed via `-f`. Paths that escape the root are rejected.
- The token is a UUIDv4 generated fresh on each start — no token is ever reused across sessions.
- `/health` is the only public endpoint.

> **Bind to `localhost` only** (the default). Do not expose this server to the public internet without additional hardening.

---

## Transport support


| Transport       | Endpoint    | Client support                             |
| --------------- | ----------- | ------------------------------------------ |
| Streamable HTTP | `POST /mcp` | Claude Desktop, Cursor, modern MCP clients |
| SSE (legacy)    | `GET /sse`  | Older MCP clients                          |


---

## Tech stack

- **TypeScript** — strict mode, NodeNext modules
- `**@modelcontextprotocol/sdk`** — MCP server + transports
- **Express** — HTTP layer
- **Commander** — CLI
- **Zod** — runtime input validation
- **UUID** — session token generation

---

## Roadmap

- Publish to npm as `openlol`
- Config file support (`.openlolrc`)
- Multiple folder scopes per session
- Https Tunnel integration for remote access
- Tool allow/deny list configuration
- Web UI for session monitoring

---

## License

MIT