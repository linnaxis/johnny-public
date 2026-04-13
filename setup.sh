#!/usr/bin/env bash
# setup.sh — One-command bootstrap for Johnny prompt compressor (Claude Code)
# Usage: ./setup.sh

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELFILE="$SCRIPT_DIR/core/Modelfile"

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; }

echo -e "${BOLD}Johnny Setup (Claude Code)${NC}"
echo ""

# --- 1. Check Ollama installed ---
info "Checking for Ollama..."
if command -v ollama &>/dev/null; then
  ok "Ollama found: $(command -v ollama)"
else
  fail "Ollama is not installed."
  echo ""
  echo "  Install Ollama:"
  echo "    macOS:  brew install ollama"
  echo "    Linux:  curl -fsSL https://ollama.com/install.sh | sh"
  echo "    Other:  https://ollama.com/download"
  echo ""
  exit 1
fi

# --- 2. Check Ollama running ---
info "Checking if Ollama is running..."
if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  ok "Ollama is running."
else
  warn "Ollama is not responding. Attempting to start..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!

  for i in $(seq 1 10); do
    if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
      ok "Ollama started (pid $OLLAMA_PID)."
      break
    fi
    sleep 1
  done

  if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    fail "Could not start Ollama. Start it manually: ollama serve"
    exit 1
  fi
fi

# --- 3. Create johnny model ---
info "Checking for johnny model..."

if ollama list 2>/dev/null | grep -q "^johnny"; then
  ok "Model 'johnny' already exists."
else
  if [ ! -f "$MODELFILE" ]; then
    fail "Modelfile not found at: $MODELFILE"
    echo "  Make sure you're running setup.sh from the johnny-compressor directory."
    exit 1
  fi

  info "Creating johnny model from Modelfile..."
  if ollama create johnny -f "$MODELFILE"; then
    ok "Model 'johnny' created."
  else
    fail "Failed to create johnny model."
    echo "  Try manually: ollama create johnny -f core/Modelfile"
    exit 1
  fi
fi

# --- 4. Install dependencies and build MCP server ---
info "Installing npm dependencies..."
if command -v node &>/dev/null; then
  cd "$SCRIPT_DIR"
  npm install --silent 2>/dev/null && ok "Dependencies installed."
  info "Building MCP server..."
  npm run build --silent 2>/dev/null && ok "MCP server built (dist/index.js)."
else
  warn "Node.js not found — skipping MCP server build."
  echo "  Install Node.js 18+ to use the MCP server for Claude Code."
fi

# --- 5. Done ---
info "Setup complete!"
echo ""
echo -e "${BOLD}Usage:${NC}"
echo ""
echo "  # Compress a prompt"
echo "  ./core/compress \"your verbose prompt here\""
echo ""
echo "  # Verbose mode (before/after comparison)"
echo "  ./core/compress -v \"your verbose prompt\""
echo ""
echo "  # Compress + copy to clipboard (macOS)"
echo "  ./core/compress -vc \"your verbose prompt\""
echo ""
echo "  # Direct Ollama"
echo "  echo \"your prompt\" | ollama run johnny"
echo ""
echo -e "${BOLD}Recommended: add a shell alias${NC}"
echo ""
echo "  echo 'alias jc=\"$SCRIPT_DIR/core/compress -vc\"' >> ~/.zshrc"
echo "  source ~/.zshrc"
echo ""
echo "  Then use: jc \"your verbose prompt\""
echo ""
echo -e "${BOLD}For OpenClaw integration, see:${NC} https://github.com/linnaxis/johnny-compressor-openclaw"
echo ""
