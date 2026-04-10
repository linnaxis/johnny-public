# Johnny

<p align="center">
  <img src="jonhnny.png" alt="Johnny" width="400">
</p>

Local prompt compression via [Ollama](https://ollama.com). Compresses verbose natural-language prompts into minimal shorthand tokens, reducing API input costs by 60-90%.

Named after the short story *Johnny Mnemonic* by William Gibson.

Works as an **MCP server for Claude Code**, a **standalone CLI tool**, or as an **[OpenClaw plugin](https://github.com/linnaxis/johnny-compressor-openclaw)**.

## How It Works

A fine-tuned Ollama model (llama3 base) strips filler words, collapses verbose phrases into terse commands, and applies a shorthand codebook — while preserving all entities, actions, and intent.

```
Input:  "Hey, can you please check my email and if there is anything new,
         summarize the key points and send me a brief overview?"

Output: "chk @new | sum | snd"
```

### Shorthand Codebook

| Code | Meaning | Code | Meaning |
|------|---------|------|---------|
| `snd` | send | `chk` | check |
| `rsch` | research | `rpt` | report |
| `rd` | read | `wr` | write |
| `ed` | edit | `fmt` | format |
| `sum` | summarize | `run` | execute |
| `@` | email | `@new` | unread |
| `#` | file | `^` | last output |
| `\|` | pipe/then | `>` | into |
| `+v` | verbose | `+d` | draft |
| `!` | no confirm | `?` | info only |
| `.html` | HTML format | `.md` | Markdown |

## Install

### Prerequisites

- [Ollama](https://ollama.com) installed and running
- Node.js 18+ (for MCP server)

### One-Command Setup

```bash
git clone https://github.com/linnaxis/johnny-compressor.git
cd johnny-compressor
./setup.sh
```

The setup script will:
1. Verify Ollama is installed (start it if not running)
2. Create the `johnny` model from the Modelfile

Safe to re-run (idempotent).

### Manual Setup

```bash
brew install ollama        # macOS (or https://ollama.com/download)
ollama serve               # start the server

git clone https://github.com/linnaxis/johnny-compressor.git
cd johnny-compressor
ollama create johnny -f core/Modelfile
npm install
npm run build
```

## Claude Code (MCP Server)

Johnny runs as an MCP server, giving Claude Code a `johnny` tool for on-demand compression.

### 1. Build

```bash
cd johnny-compressor
npm install
npm run build
```

### 2. Configure

Add to your `~/.mcp.json` (or merge into existing):

```json
{
  "mcpServers": {
    "johnny": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/johnny-compressor/dist/index.js"],
      "env": {
        "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
        "JOHNNY_MODEL": "johnny"
      }
    }
  }
}
```

### 3. Verify

Start Claude Code. You should see 2 new tools:
- `johnny` — compress verbose text into minimal shorthand tokens
- `johnny_status` — check Ollama connectivity and model availability

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API endpoint |
| `JOHNNY_MODEL` | `johnny` | Ollama model name |

### Remote Ollama

If Ollama runs on a different machine (e.g., your Mac while Claude Code runs in a container):

```json
"env": {
  "OLLAMA_BASE_URL": "http://<your-ollama-host>:11434"
}
```

Make sure Ollama is started with `OLLAMA_HOST=0.0.0.0 ollama serve` to accept remote connections.

## CLI Usage

The `core/compress` bash script works standalone without the MCP server:

```bash
# Basic compression
./core/compress "Can you check my email and summarize anything new?"

# Verbose mode (shows before/after with token estimates)
./core/compress -v "I need you to analyze our trading data and prepare a report"

# Copy to clipboard (macOS)
./core/compress -c "Please research the latest news about dark pools in APAC"

# Verbose + copy
./core/compress -vc "your verbose prompt"

# From stdin
echo "Write a detailed market report and send it as HTML" | ./core/compress

# Direct Ollama
echo "your verbose prompt" | ollama run johnny
```

### Shell Alias

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias jc='/path/to/johnny-compressor/core/compress -vc'
```

Then: `jc "your verbose prompt"` — compresses, shows comparison, copies to clipboard.

## OpenClaw Integration

For [OpenClaw](https://github.com/openclaw/openclaw) users, Johnny is also available as a plugin with auto-compression, health checks, and a `/johnny` command.

See [johnny-compressor-openclaw](https://github.com/linnaxis/johnny-compressor-openclaw) for the OpenClaw plugin.

## Troubleshooting

**Ollama not found**
Install from https://ollama.com or `brew install ollama` on macOS.

**Ollama not responding**
Run `ollama serve` to start the Ollama server.

**Model not found**
Run `ollama create johnny -f core/Modelfile` from this directory.

**MCP server not connecting**
Check `dist/index.js` exists (run `npm run build`). Verify the absolute path in `.mcp.json`.

**Remote Ollama not reachable**
Start Ollama with `OLLAMA_HOST=0.0.0.0 ollama serve` and verify the URL with `curl <url>/api/tags`.

## Project Structure

```
johnny-compressor/
├── README.md
├── package.json
├── tsconfig.json
├── LICENSE
├── setup.sh                # One-command bootstrap
├── .mcp.json.example       # MCP config template
├── src/
│   └── index.ts            # MCP server (johnny + johnny_status tools)
├── dist/                   # Built output (after npm run build)
└── core/
    ├── Modelfile           # Ollama model definition (llama3 base)
    └── compress            # CLI compression script (bash)
```

## License

MIT
