/**
 * Validation Operations
 * Implements code validation, testing, and quality tools for rotation-engine
 */

interface CommandResult {
  output: string;
  error?: string;
}

/**
 * Execute shell command in rotation-engine directory
 */
async function executeCommand(
  command: string,
  args: string[],
  engineRoot: string,
  timeoutMs: number = 30000
): Promise<CommandResult> {
  try {
    const cmd = new Deno.Command(command, {
      args,
      cwd: engineRoot,
      stdout: "piped",
      stderr: "piped",
    });

    const process = cmd.spawn();
    
    // Timeout protection
    const timeoutId = setTimeout(() => {
      try {
        process.kill("SIGTERM");
      } catch (e) {
        console.error("Failed to kill process:", e);
      }
    }, timeoutMs);

    const { code, stdout, stderr } = await process.output();
    clearTimeout(timeoutId);

    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);

    if (code !== 0 && errorOutput) {
      return { output, error: errorOutput };
    }

    return { output: output || errorOutput };
  } catch (error) {
    return {
      output: "",
      error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Run pytest test suite
 */
export async function runTests(
  path: string | undefined,
  engineRoot: string,
  verbose: boolean = false
): Promise<CommandResult> {
  const args = ["-m", "pytest"];
  
  if (verbose) {
    args.push("-v");
  }
  
  if (path) {
    args.push(path);
  }
  
  args.push("--tb=short"); // Short traceback format
  
  return executeCommand("python", args, engineRoot, 60000); // 60s timeout for tests
}

/**
 * Validate strategy file syntax and basic logic
 */
export async function validateStrategy(
  path: string,
  engineRoot: string
): Promise<CommandResult> {
  // First check Python syntax
  const syntaxCheck = await executeCommand(
    "python",
    ["-m", "py_compile", path],
    engineRoot
  );
  
  if (syntaxCheck.error) {
    return { output: "", error: `Syntax error: ${syntaxCheck.error}` };
  }
  
  // Then try to import and validate structure
  const validationScript = `
import sys
import importlib.util
from pathlib import Path

def validate_strategy(path):
    spec = importlib.util.spec_from_file_location("strategy", path)
    if spec is None or spec.loader is None:
        return "Failed to load module spec"
    
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        return f"Import error: {e}"
    
    # Check for required attributes/functions
    required = ["generate_signal", "get_params"]
    missing = [r for r in required if not hasattr(module, r)]
    
    if missing:
        return f"Missing required functions: {', '.join(missing)}"
    
    return "Strategy validation passed"

if __name__ == "__main__":
    result = validate_strategy(sys.argv[1])
    print(result)
`;
  
  const tempScript = await Deno.makeTempFile({ suffix: ".py" });
  await Deno.writeTextFile(tempScript, validationScript);
  
  const result = await executeCommand(
    "python",
    [tempScript, path],
    engineRoot
  );
  
  try {
    await Deno.remove(tempScript);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  return result;
}

/**
 * Dry-run backtest (quick validation without full execution)
 */
export async function dryRunBacktest(
  strategyKey: string,
  startDate: string,
  endDate: string,
  engineRoot: string
): Promise<CommandResult> {
  const dryRunScript = `
import sys
from datetime import datetime

def dry_run_backtest(strategy_key, start_date, end_date):
    # Quick validation checks
    checks = []
    
    # Date validation
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        if end <= start:
            checks.append("❌ End date must be after start date")
        else:
            checks.append(f"✓ Date range valid: {(end - start).days} days")
    except ValueError as e:
        checks.append(f"❌ Invalid date format: {e}")
    
    # Strategy file exists
    strategy_file = f"strategies/{strategy_key}.py"
    try:
        with open(strategy_file, 'r') as f:
            checks.append(f"✓ Strategy file found: {strategy_file}")
    except FileNotFoundError:
        checks.append(f"❌ Strategy file not found: {strategy_file}")
    
    # Data availability (stub check)
    checks.append("✓ Data availability check passed (stub)")
    
    # Dependencies check
    try:
        import pandas
        import numpy
        checks.append("✓ Core dependencies available")
    except ImportError as e:
        checks.append(f"❌ Missing dependency: {e}")
    
    return "\\n".join(checks)

if __name__ == "__main__":
    result = dry_run_backtest(sys.argv[1], sys.argv[2], sys.argv[3])
    print(result)
`;
  
  const tempScript = await Deno.makeTempFile({ suffix: ".py" });
  await Deno.writeTextFile(tempScript, dryRunScript);
  
  const result = await executeCommand(
    "python",
    [tempScript, strategyKey, startDate, endDate],
    engineRoot
  );
  
  try {
    await Deno.remove(tempScript);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  return result;
}

/**
 * Run code linter (pylint or flake8)
 */
export async function lintCode(
  path: string,
  engineRoot: string
): Promise<CommandResult> {
  // Try flake8 first, fall back to pylint
  let result = await executeCommand(
    "python",
    ["-m", "flake8", path, "--max-line-length=100"],
    engineRoot
  );
  
  if (result.error && result.error.includes("No module named")) {
    // Try pylint as fallback
    result = await executeCommand(
      "python",
      ["-m", "pylint", path, "--max-line-length=100"],
      engineRoot
    );
  }
  
  return result;
}

/**
 * Format code with black or autopep8
 */
export async function formatCode(
  path: string,
  engineRoot: string,
  check: boolean = true
): Promise<CommandResult> {
  const args = ["-m", "black"];
  
  if (check) {
    args.push("--check"); // Don't modify, just check
    args.push("--diff"); // Show what would change
  }
  
  args.push(path);
  
  return executeCommand("python", args, engineRoot);
}

/**
 * Run mypy type checking
 */
export async function typeCheck(
  path: string,
  engineRoot: string
): Promise<CommandResult> {
  return executeCommand(
    "python",
    ["-m", "mypy", path, "--ignore-missing-imports"],
    engineRoot
  );
}

/**
 * Check if dependencies are installed
 */
export async function checkDependencies(
  engineRoot: string
): Promise<CommandResult> {
  const checkScript = `
import sys
import importlib

required = [
    "pandas", "numpy", "scipy", "matplotlib",
    "pytest", "black", "flake8", "mypy"
]

results = []
for pkg in required:
    try:
        importlib.import_module(pkg)
        results.append(f"✓ {pkg}")
    except ImportError:
        results.append(f"❌ {pkg} (missing)")

print("\\n".join(results))
`;
  
  const tempScript = await Deno.makeTempFile({ suffix: ".py" });
  await Deno.writeTextFile(tempScript, checkScript);
  
  const result = await executeCommand("python", [tempScript], engineRoot);
  
  try {
    await Deno.remove(tempScript);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  return result;
}

/**
 * Check for outdated packages
 */
export async function checkOutdatedPackages(
  engineRoot: string
): Promise<CommandResult> {
  return executeCommand(
    "python",
    ["-m", "pip", "list", "--outdated"],
    engineRoot,
    15000
  );
}

/**
 * Check Python version compatibility
 */
export async function checkPythonVersion(
  engineRoot: string
): Promise<CommandResult> {
  return executeCommand(
    "python",
    ["--version"],
    engineRoot
  );
}
