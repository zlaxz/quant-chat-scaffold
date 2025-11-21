/**
 * Code Analysis Operations
 * Implements AST-based code analysis tools for rotation-engine
 */

interface CommandResult {
  output: string;
  error?: string;
}

/**
 * Execute Python script for analysis
 */
async function executePythonScript(
  script: string,
  args: string[],
  engineRoot: string,
  timeoutMs: number = 30000
): Promise<CommandResult> {
  try {
    const tempScript = await Deno.makeTempFile({ suffix: ".py" });
    await Deno.writeTextFile(tempScript, script);

    const cmd = new Deno.Command("python", {
      args: [tempScript, ...args],
      cwd: engineRoot,
      stdout: "piped",
      stderr: "piped",
    });

    const process = cmd.spawn();
    
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

    try {
      await Deno.remove(tempScript);
    } catch (e) {
      // Ignore cleanup errors
    }

    if (code !== 0 && errorOutput) {
      return { output, error: errorOutput };
    }

    return { output: output || errorOutput };
  } catch (error) {
    return {
      output: "",
      error: `Script execution failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Find function definition in codebase
 */
export async function findFunction(
  name: string,
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
import os
from pathlib import Path

def safe_relative_path(file_path, base_path):
    """Safely get relative path, fallback to filename if it fails"""
    try:
        return str(file_path.relative_to(base_path))
    except (ValueError, TypeError):
        return file_path.name

def find_function(name, search_path):
    results = []
    root = Path(search_path).resolve()
    
    # Find all Python files
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return f"❌ Path not found: {search_path}"
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == name:
                    # Get function signature
                    args_list = []
                    for arg in node.args.args:
                        args_list.append(arg.arg)
                    signature = f"{name}({', '.join(args_list)})"
                    
                    # Get docstring
                    docstring = ast.get_docstring(node) or "No docstring"
                    
                    # Get line number
                    line_no = node.lineno
                    
                    rel_path = safe_relative_path(file_path, root)
                    results.append(f"""
📍 {rel_path}:{line_no}
   Signature: {signature}
   Docstring: {docstring[:100]}{"..." if len(docstring) > 100 else ""}
""")
        except Exception as e:
            # Log but continue
            pass
    
    if not results:
        return f"❌ Function '{name}' not found in {search_path}"
    
    return "\\n".join(results)

if __name__ == "__main__":
    print(find_function(sys.argv[1], sys.argv[2]))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [name, searchPath], engineRoot);
}

/**
 * Find class definition in codebase
 */
export async function findClass(
  name: string,
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path

def safe_relative_path(file_path, base_path):
    """Safely get relative path, fallback to filename if it fails"""
    try:
        return str(file_path.relative_to(base_path))
    except (ValueError, TypeError):
        return file_path.name

def find_class(name, search_path):
    results = []
    root = Path(search_path).resolve()
    
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return f"❌ Path not found: {search_path}"
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef) and node.name == name:
                    # Get base classes
                    bases = [b.id if isinstance(b, ast.Name) else str(b) for b in node.bases]
                    inheritance = f"({', '.join(bases)})" if bases else ""
                    
                    # Get methods
                    methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
                    
                    # Get docstring
                    docstring = ast.get_docstring(node) or "No docstring"
                    
                    rel_path = safe_relative_path(file_path, root)
                    results.append(f"""
📍 {rel_path}:{node.lineno}
   Class: {name}{inheritance}
   Methods: {', '.join(methods[:10])}{"..." if len(methods) > 10 else ""}
   Docstring: {docstring[:100]}{"..." if len(docstring) > 100 else ""}
""")
        except Exception:
            pass
    
    if not results:
        return f"❌ Class '{name}' not found in {search_path}"
    
    return "\\n".join(results)

if __name__ == "__main__":
    print(find_class(sys.argv[1], sys.argv[2]))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [name, searchPath], engineRoot);
}

/**
 * Find all usages of a symbol (function/class/variable)
 */
export async function findUsages(
  symbol: string,
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path

def safe_relative_path(file_path, base_path):
    """Safely get relative path, fallback to filename if it fails"""
    try:
        return str(file_path.relative_to(base_path))
    except (ValueError, TypeError):
        return file_path.name

def find_usages(symbol, search_path):
    results = []
    root = Path(search_path).resolve()
    
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return f"❌ Path not found: {search_path}"
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                content = ''.join(lines)
            
            tree = ast.parse(content, filename=str(file_path))
            rel_path = safe_relative_path(file_path, root)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Name) and node.id == symbol:
                    line_no = node.lineno
                    context = lines[line_no - 1].strip() if line_no <= len(lines) else ""
                    results.append(f"  {rel_path}:{line_no} - {context[:80]}")
                
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name) and node.func.id == symbol:
                        line_no = node.lineno
                        context = lines[line_no - 1].strip() if line_no <= len(lines) else ""
                        results.append(f"  {rel_path}:{line_no} - {context[:80]}")
        except Exception:
            pass
    
    if not results:
        return f"❌ No usages found for '{symbol}' in {search_path}"
    
    # Deduplicate and limit results
    unique_results = list(dict.fromkeys(results))
    return f"Found {len(unique_results)} usage(s) of '{symbol}':\\n" + "\\n".join(unique_results[:50])

if __name__ == "__main__":
    print(find_usages(sys.argv[1], sys.argv[2]))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [symbol, searchPath], engineRoot);
}

/**
 * Generate call graph for a function
 */
export async function generateCallGraph(
  functionName: string,
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path
from collections import defaultdict

def safe_relative_path(file_path, base_path):
    """Safely get relative path, fallback to filename if it fails"""
    try:
        return str(file_path.relative_to(base_path))
    except (ValueError, TypeError):
        return file_path.name

def analyze_calls(search_path):
    call_graph = defaultdict(set)
    definitions = {}
    root = Path(search_path).resolve()
    
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return {}, {}
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            rel_path = safe_relative_path(file_path, root)
            
            # Find all function definitions
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    definitions[node.name] = rel_path
                    
                    # Find calls within this function
                    for child in ast.walk(node):
                        if isinstance(child, ast.Call):
                            if isinstance(child.func, ast.Name):
                                call_graph[node.name].add(child.func.id)
        except Exception:
            pass
    
    return call_graph, definitions

def build_graph(func_name, call_graph, definitions, depth=0, visited=None):
    if visited is None:
        visited = set()
    
    if depth > 3 or func_name in visited:  # Limit depth
        return []
    
    visited.add(func_name)
    indent = "  " * depth
    
    location = definitions.get(func_name, "unknown")
    result = [f"{indent}{'└─' if depth > 0 else '▶'} {func_name} ({location})"]
    
    if func_name in call_graph:
        for called in sorted(call_graph[func_name]):
            result.extend(build_graph(called, call_graph, definitions, depth + 1, visited.copy()))
    
    return result

if __name__ == "__main__":
    func_name = sys.argv[1]
    search_path = sys.argv[2]
    
    call_graph, definitions = analyze_calls(search_path)
    
    if func_name not in definitions:
        print(f"❌ Function '{func_name}' not found in {search_path}")
    else:
        print(f"Call graph for '{func_name}':\\n")
        print("\\n".join(build_graph(func_name, call_graph, definitions)))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [functionName, searchPath], engineRoot);
}

/**
 * Show import dependency tree
 */
export async function generateImportTree(
  moduleName: string,
  engineRoot: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path
from collections import defaultdict

def analyze_imports(search_path):
    import_graph = defaultdict(set)
    root = Path(search_path).resolve()
    
    if not root.is_dir():
        return {}
    
    py_files = list(root.rglob("*.py"))
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            
            # Get module name from file path
            try:
                rel_path = file_path.relative_to(root)
                module_name = str(rel_path.with_suffix('')).replace('/', '.').replace('\\\\', '.')
            except (ValueError, TypeError):
                continue
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        import_graph[module_name].add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        import_graph[module_name].add(node.module)
        except Exception:
            pass
    
    return import_graph

def build_import_tree(module, import_graph, depth=0, visited=None):
    if visited is None:
        visited = set()
    
    if depth > 3 or module in visited:
        return []
    
    visited.add(module)
    indent = "  " * depth
    
    result = [f"{indent}{'└─' if depth > 0 else '▶'} {module}"]
    
    if module in import_graph:
        for imported in sorted(import_graph[module]):
            if imported.startswith('.'):  # Skip relative imports
                continue
            result.extend(build_import_tree(imported, import_graph, depth + 1, visited.copy()))
    
    return result

if __name__ == "__main__":
    module = sys.argv[1]
    
    import_graph = analyze_imports('.')
    
    if not import_graph:
        print(f"❌ No Python files found or failed to analyze imports")
    elif module not in import_graph:
        print(f"❌ Module '{module}' not found in import graph")
    else:
        print(f"Import tree for '{module}':\\n")
        print("\\n".join(build_import_tree(module, import_graph)))
`;

  return executePythonScript(script, [moduleName], engineRoot);
}

/**
 * Find dead code (unused functions/classes)
 */
export async function findDeadCode(
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path

def safe_relative_path(file_path, base_path):
    """Safely get relative path, fallback to filename if it fails"""
    try:
        return str(file_path.relative_to(base_path))
    except (ValueError, TypeError):
        return file_path.name

def find_dead_code(search_path):
    definitions = set()
    usages = set()
    root = Path(search_path).resolve()
    
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return f"❌ Path not found: {search_path}"
    
    # First pass: find all definitions
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            rel_path = safe_relative_path(file_path, root)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if not node.name.startswith('_'):  # Skip private
                        definitions.add((node.name, rel_path, node.lineno))
                elif isinstance(node, ast.ClassDef):
                    if not node.name.startswith('_'):
                        definitions.add((node.name, rel_path, node.lineno))
        except Exception:
            pass
    
    # Second pass: find all usages
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=str(file_path))
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Name):
                    usages.add(node.id)
                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    usages.add(node.func.id)
        except Exception:
            pass
    
    # Find unused definitions
    unused = []
    for name, path, line in definitions:
        if name not in usages:
            unused.append(f"  {path}:{line} - {name}")
    
    if not unused:
        return "✓ No obvious dead code found"
    
    return f"Found {len(unused)} potentially unused definition(s):\\n" + "\\n".join(unused[:30])

if __name__ == "__main__":
    print(find_dead_code(sys.argv[1]))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [searchPath], engineRoot);
}

/**
 * Calculate cyclomatic complexity
 */
export async function calculateComplexity(
  engineRoot: string,
  path: string
): Promise<CommandResult> {
  const script = `
import sys
import ast
from pathlib import Path

def calculate_complexity(node):
    """Calculate cyclomatic complexity for a function"""
    complexity = 1  # Base complexity
    
    for child in ast.walk(node):
        # Add 1 for each decision point
        if isinstance(child, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
            complexity += 1
        elif isinstance(child, ast.BoolOp):
            complexity += len(child.values) - 1
    
    return complexity

def analyze_file(file_path):
    results = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content, filename=str(file_path))
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                complexity = calculate_complexity(node)
                
                # Classify complexity
                if complexity <= 5:
                    level = "✓ Low"
                elif complexity <= 10:
                    level = "⚠ Medium"
                else:
                    level = "❌ High"
                
                # Format with proper padding
                name_padded = node.name[:40].ljust(40)
                results.append({
                    'name': node.name,
                    'complexity': complexity,
                    'level': level,
                    'display': f"  {name_padded} | Complexity: {complexity:2} | {level}"
                })
        
        if not results:
            return "No functions found"
        
        # Sort by complexity (descending)
        results.sort(key=lambda x: x['complexity'], reverse=True)
        return "\\n".join([r['display'] for r in results[:20]])
        
    except FileNotFoundError:
        return f"❌ File not found: {file_path}"
    except SyntaxError as e:
        return f"❌ Syntax error in file: {e}"
    except Exception as e:
        return f"❌ Error analyzing file: {str(e)}"

if __name__ == "__main__":
    print(analyze_file(sys.argv[1]))
`;

  return executePythonScript(script, [path], engineRoot);
}

/**
 * Generate codebase statistics
 */
export async function generateCodeStats(
  engineRoot: string,
  path?: string
): Promise<CommandResult> {
  const script = `
import sys
from pathlib import Path

def analyze_codebase(search_path):
    root = Path(search_path).resolve()
    
    if root.is_dir():
        py_files = list(root.rglob("*.py"))
    elif root.is_file():
        py_files = [root]
    else:
        return f"❌ Path not found: {search_path}"
    
    total_lines = 0
    code_lines = 0
    comment_lines = 0
    blank_lines = 0
    function_count = 0
    class_count = 0
    
    for file_path in py_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    total_lines += 1
                    stripped = line.strip()
                    
                    if not stripped:
                        blank_lines += 1
                    elif stripped.startswith('#'):
                        comment_lines += 1
                    else:
                        code_lines += 1
                        
                        if stripped.startswith('def '):
                            function_count += 1
                        elif stripped.startswith('class '):
                            class_count += 1
        except Exception:
            pass
    
    comment_ratio = (comment_lines / total_lines * 100) if total_lines > 0 else 0
    
    return f"""
Codebase Statistics:
──────────────────────────────
Files analyzed:     {len(py_files)}
Total lines:        {total_lines:,}
Code lines:         {code_lines:,}
Comment lines:      {comment_lines:,} ({comment_ratio:.1f}%)
Blank lines:        {blank_lines:,}
──────────────────────────────
Functions:          {function_count:,}
Classes:            {class_count:,}
──────────────────────────────
"""

if __name__ == "__main__":
    print(analyze_codebase(sys.argv[1]))
`;

  const searchPath = path || ".";
  return executePythonScript(script, [searchPath], engineRoot);
}
