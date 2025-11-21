# Rotation Engine Bridge Server

Simple HTTP bridge that allows Chief Quant to execute Python backtests directly from chat.

## Setup (One Time)

1. **Copy this folder to your rotation-engine directory:**
   ```bash
   # If rotation-engine-bridge is in your Lovable project:
   cp -r rotation-engine-bridge /Users/zstoc/rotation-engine/
   ```

2. **Navigate to rotation-engine:**
   ```bash
   cd /Users/zstoc/rotation-engine
   ```

3. **Start the bridge server:**
   ```bash
   python rotation-engine-bridge/bridge_server.py
   ```

That's it! Leave it running in a terminal window.

## Usage

Once the bridge is running, Chief Quant can execute backtests directly from chat:
- Request backtests through `/backtest` command or natural conversation
- Chief Quant receives real results from your rotation-engine
- Results automatically saved to database and displayed in chat
- No manual copying/pasting required

## What It Does

- Listens on `http://localhost:8080`
- Receives backtest requests from Supabase edge functions
- Executes your rotation-engine Python code
- Returns metrics, equity curves, and trade logs
- Handles errors gracefully

## Requirements

- Python 3.7+
- Your rotation-engine must have a CLI interface that accepts:
  - `--profile` (strategy key)
  - `--start` (start date)
  - `--end` (end date)
  - `--capital` (initial capital)
  - `--output json` (JSON output format)

## Customization

If your rotation-engine CLI uses different command structure, edit `bridge_server.py` line 40-47 to match your actual command format.

## Troubleshooting

**Bridge not connecting?**
- Verify bridge_server.py is running (you should see "Ready to execute backtests")
- Check port 8080 isn't already in use
- Ensure you're in the rotation-engine directory when running

**Backtests failing?**
- Check bridge_server.py terminal for error messages
- Verify your rotation-engine CLI works independently
- Confirm command format matches your engine's interface

**Fallback behavior:**
- If bridge isn't running, system falls back to stub results
- You'll see "stub_fallback" in the engine_source field
- No crashes - just fake data until bridge is started
