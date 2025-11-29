# Quant Chat Workbench - Quick Start Guide

## Prerequisites

- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **Python 3.7+** - [Download from python.org](https://www.python.org/downloads/)
- **Git** (for rotation-engine integration)

---

## Installation (5 minutes)

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the project root:

```bash
# Required: Your rotation-engine path (absolute path)
ROTATION_ENGINE_ROOT=/Users/yourname/rotation-engine

# Required: LLM API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Supabase (already configured - DO NOT CHANGE)
VITE_SUPABASE_URL=https://ynaqtawyynqikfyranda.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYXF0YXd5eW5xaWtmeXJhbmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NzM5NjMsImV4cCI6MjA3OTE0OTk2M30.VegcJvLluy8toSYqnR7Ufc5jx5XAl1-XeDRl8KbsIIw
```

**Important Notes:**
- Variables without `VITE_` prefix are for Electron main process (backend)
- Variables with `VITE_` prefix are for React frontend
- Both are required for full functionality

### 3. Set Up Python Bridge
```bash
# Navigate to bridge directory
cd rotation-engine-bridge

# Install Python dependencies
pip install -r requirements.txt

# Make script executable (Mac/Linux)
chmod +x cli_wrapper.py

# Test it works
python3 cli_wrapper.py --help
```

### 4. Verify Installation

**Test Python:**
```bash
python3 --version  # Should show 3.7 or higher
```

**Test Rotation Engine Access:**
```bash
ls $ROTATION_ENGINE_ROOT  # Should show your engine files
```

**Test CLI Wrapper:**
```bash
cd rotation-engine-bridge
python3 cli_wrapper.py --profile test --start 2023-01-01 --end 2023-12-31
# Should output JSON with runId, metrics, equity_curve, trades
```

### 5. Start the App

**Development Mode:**
```bash
npm run electron:dev
```

**Production Build:**
```bash
npm run electron:build
```

The app will open automatically. If you see a "Python Environment Error" dialog, follow the troubleshooting section below.

---

## Troubleshooting

### "Python3 not found"
Install Python from python.org or use a package manager:

**macOS:**
```bash
brew install python@3
```

**Ubuntu/Debian:**
```bash
sudo apt install python3 python3-pip
```

**Windows:**
Download from [python.org](https://www.python.org/downloads/) and ensure "Add to PATH" is checked during installation.

### "cli_wrapper.py not found"
Make sure you're setting `ROTATION_ENGINE_ROOT` to the directory containing the `rotation-engine-bridge` folder. Check:
```bash
ls $ROTATION_ENGINE_ROOT/rotation-engine-bridge/cli_wrapper.py
```

### "Module 'boto3' not found" or other import errors
Install Python dependencies:
```bash
cd rotation-engine-bridge
pip install -r requirements.txt
```

If using a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### "No project directory configured"
1. Open the app
2. Go to **Settings** (gear icon)
3. Click **Project Directory** tab
4. Click **Browse** and select your rotation-engine folder
5. Or click **Create Default** to create a new directory

### Backtests fail with "subprocess error"
Check that the CLI wrapper is configured correctly:
```bash
cd rotation-engine-bridge
python3 cli_wrapper.py --profile skew_v1 --start 2023-01-01 --end 2023-12-31
```

If this fails, you need to integrate the wrapper with your actual rotation-engine code (see comments in `cli_wrapper.py`).

### API calls fail or LLM doesn't respond
Verify your API keys are set in `.env`:
```bash
# Check keys are loaded (should show asterisks, not the actual key)
cat .env | grep API_KEY
```

Test each API:
- **Gemini:** [Get key from Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI:** [Get key from OpenAI Platform](https://platform.openai.com/api-keys)
- **DeepSeek:** [Get key from DeepSeek](https://platform.deepseek.com/)

---

## First Steps

Once the app is running:

1. **Set Project Directory:**
   - Settings → Project Directory → Browse to your rotation-engine folder

2. **Test File Access:**
   - In chat, type: `/list_dir .`
   - You should see your rotation-engine directory structure

3. **Run Your First Backtest:**
   - In chat, type: `Run a backtest on skew_v1 from 2023-01-01 to 2023-12-31`
   - Chief Quant will execute the backtest and show results

4. **Explore Features:**
   - Type `/help` to see all available slash commands
   - Browse your code with `/list_dir` and `/open_file`
   - Run Python scripts with Chief Quant

---

## Need Help?

- **Documentation:** See `ELECTRON_SETUP.md` for architecture details
- **Issues:** Check `CRITICAL_FAILURES_AUDIT.md` for known issues and fixes
- **Support:** Open an issue on GitHub or contact support

---

## What's Next?

After setup, you can:
- Integrate `cli_wrapper.py` with your actual rotation-engine code
- Configure strategy profiles in your rotation-engine
- Set up data sources (Massive.com, Polygon, local files)
- Start running real backtests and analyzing results with Chief Quant
