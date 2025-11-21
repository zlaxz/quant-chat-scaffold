# Bridge Setup Guide - Chief Quant ↔ Rotation Engine

This guide shows you how to connect Chief Quant to your local rotation-engine so you can run real Python backtests directly from chat.

## What You Need

- Your rotation-engine at `/Users/zstoc/rotation-engine`
- Python 3.7 or higher
- 5 minutes for one-time setup

## Setup Steps

### Step 1: Copy Bridge Server (One Time)

The `rotation-engine-bridge` folder in this Lovable project contains the bridge server. You need to copy it to your rotation-engine directory:

**Option A - If you're comfortable with terminal:**
```bash
# Navigate to your Lovable project
cd ~/path/to/quant-chat-workbench

# Copy bridge to rotation-engine
cp -r rotation-engine-bridge /Users/zstoc/rotation-engine/
```

**Option B - Using Finder (easier):**
1. Open this Lovable project folder in Finder
2. Find the `rotation-engine-bridge` folder
3. Copy it (Cmd+C)
4. Open `/Users/zstoc/rotation-engine` in Finder
5. Paste it (Cmd+V)

### Step 2: Customize for Your Engine (Important!)

The bridge server needs to know HOW to run your rotation-engine. Open the file:
```
/Users/zstoc/rotation-engine/rotation-engine-bridge/bridge_server.py
```

**Find this section (around line 40):**
```python
# Build command to execute rotation-engine
# Adjust this command based on your actual rotation-engine CLI
cmd = [
    'python', '-m', 'rotation_engine.cli',
    'backtest',
    '--profile', strategy_key,
    '--start', start_date,
    '--end', end_date,
    '--capital', str(capital),
    '--output', 'json'
]
```

**Update it to match YOUR rotation-engine's actual command structure.**

For example, if your command normally looks like:
```bash
python run_backtest.py --strategy skew_v1 --start 2023-01-01 --end 2023-12-31
```

Then update the bridge to:
```python
cmd = [
    'python', 'run_backtest.py',
    '--strategy', strategy_key,
    '--start', start_date,
    '--end', end_date,
    # Add other flags your engine needs
]
```

### Step 3: Start the Bridge (Every Time You Work)

Whenever you want to use Chief Quant with real backtests:

1. Open Terminal
2. Navigate to your rotation-engine:
   ```bash
   cd /Users/zstoc/rotation-engine
   ```
3. Start the bridge:
   ```bash
   python rotation-engine-bridge/bridge_server.py
   ```

You should see:
```
============================================================
🌉 Rotation Engine Bridge Server
============================================================
📡 Listening on http://localhost:8080
📁 Working directory: /Users/zstoc/rotation-engine

✨ Ready to execute backtests from Chief Quant
🛑 Press Ctrl+C to stop
```

**Leave this terminal window open** while you work in the Quant Chat interface.

## How It Works

Once the bridge is running:

1. **You talk to Chief Quant in the chat**
   - "Run a backtest for skew_v1 from 2023-01-01 to 2024-01-01"

2. **Chief Quant sends the request through the bridge**
   - Bridge receives the command
   - Bridge executes your rotation-engine Python code
   - Bridge waits for results

3. **Results flow back to Chief Quant**
   - Metrics, equity curves, and trade logs
   - Stored in database
   - Displayed in chat
   - Ready for analysis

4. **Chief Quant analyzes everything**
   - Reviews the results
   - Suggests next experiments
   - Updates memory with insights
   - All through conversation

## What If the Bridge Isn't Running?

No problem! The system automatically falls back to stub (fake) results so you can still:
- Test the interface
- Practice workflows
- See what the results look like

You'll know it's using stub data because `engine_source` will show `stub_fallback` instead of `rotation-engine-bridge`.

## Troubleshooting

### "Bridge not connecting"
- ✅ Is the bridge server running? (Check the terminal window)
- ✅ Did you see the "Ready to execute backtests" message?
- ✅ Is port 8080 available? (Close other apps using it)

### "Backtests failing"
- ✅ Check the bridge server terminal for error messages
- ✅ Does your rotation-engine CLI command work independently?
- ✅ Did you customize the `cmd` array in bridge_server.py?
- ✅ Are all required Python dependencies installed?

### "Results look fake"
- If you see perfect round numbers or identical equity curves, you're probably seeing stub data
- Check the `engine_source` field in the results - should say `rotation-engine-bridge`
- Verify the bridge terminal shows "Received backtest request" messages

## Next Steps

Once the bridge is running and working:

1. **Test with a simple backtest:**
   - Ask Chief Quant: "Run a backtest for [your strategy] from [start] to [end]"
   - Watch the bridge terminal for execution logs
   - Verify real results appear in chat

2. **Start researching:**
   - Chief Quant can now read your code, run experiments, analyze results
   - Everything happens in chat - no switching between tools
   - Memory system captures insights automatically

3. **Iterate naturally:**
   - Ask for code reviews
   - Request experiment suggestions
   - Let Chief Quant propose changes
   - Run tests immediately to validate

## Support

If you get stuck:
- Check the bridge terminal for detailed error messages
- Review the `rotation-engine-bridge/README.md` for technical details
- Ask Chief Quant: "Help me debug the bridge connection"
