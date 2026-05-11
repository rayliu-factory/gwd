# CLI Flags

## Starting GWD

| Flag | Description |
|------|-------------|
| `gwd` | Start a new interactive session |
| `gwd --continue` (`-c`) | Resume the most recent session |
| `gwd --model <id>` | Override the default model for this session |
| `gwd --web [path]` | Start browser-based web interface |
| `gwd --worktree` (`-w`) [name] | Start in a git worktree |
| `gwd --no-session` | Disable session persistence |
| `gwd --extension <path>` | Load an additional extension (repeatable) |
| `gwd --append-system-prompt <text>` | Append text to the system prompt |
| `gwd --tools <list>` | Comma-separated tools to enable |
| `gwd --version` (`-v`) | Print version and exit |
| `gwd --help` (`-h`) | Print help and exit |
| `gwd --debug` | Enable diagnostic logging |

## Non-Interactive Modes

| Flag | Description |
|------|-------------|
| `gwd --print "msg"` (`-p`) | Single-shot prompt mode (no TUI) |
| `gwd --mode <text\|json\|rpc\|mcp>` | Output mode for non-interactive use |

## Session Management

| Command | Description |
|---------|-------------|
| `gwd sessions` | Interactive session picker — list and resume saved sessions |
| `gwd --list-models [search]` | List available models and exit |

## Configuration

| Command | Description |
|---------|-------------|
| `gwd config` | Set up global API keys |
| `gwd update` | Update to the latest version |

## Headless Mode

| Flag | Description |
|------|-------------|
| `gwd headless` | Run without TUI |
| `gwd headless --timeout N` | Timeout in ms (default: 300000) |
| `gwd headless --max-restarts N` | Auto-restart on crash (default: 3) |
| `gwd headless --json` | Stream events as JSONL |
| `gwd headless --model ID` | Override model |
| `gwd headless --context <file>` | Context file for `new-milestone` |
| `gwd headless --context-text <text>` | Inline context for `new-milestone` |
| `gwd headless --auto` | Chain into auto mode after milestone creation |
| `gwd headless query` | Instant JSON state snapshot (~50ms) |

## Web Interface

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `localhost` | Bind address |
| `--port` | `3000` | Port |
| `--allowed-origins` | (none) | CORS origins |
