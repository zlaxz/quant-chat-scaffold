/**
 * File system operations for rotation-engine codebase
 */

export interface FileResult {
  content?: string;
  error?: string;
}

export interface DirectoryResult {
  items?: Array<{ name: string; type: 'file' | 'directory' }>;
  error?: string;
}

export interface SearchResult {
  matches?: Array<{ file: string; line: number; content: string }>;
  error?: string;
}

function validatePath(path: string, engineRoot: string): { valid: boolean; fullPath: string; error?: string } {
  // Remove leading slash and normalize
  const cleanPath = path.replace(/^\/+/, '').replace(/\\/g, '/');
  
  // Check for directory traversal
  if (cleanPath.includes('..') || cleanPath.startsWith('/')) {
    return { valid: false, fullPath: '', error: 'Invalid path: directory traversal not allowed' };
  }
  
  const fullPath = `${engineRoot}/${cleanPath}`;
  return { valid: true, fullPath };
}

export async function readFile(path: string, engineRoot: string): Promise<FileResult> {
  try {
    const validation = validatePath(path, engineRoot);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const content = await Deno.readTextFile(validation.fullPath);
    return { content };
  } catch (error) {
    return { error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function listDirectory(path: string, engineRoot: string): Promise<DirectoryResult> {
  try {
    const validation = validatePath(path || '.', engineRoot);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const items: Array<{ name: string; type: 'file' | 'directory' }> = [];
    
    for await (const entry of Deno.readDir(validation.fullPath)) {
      items.push({
        name: entry.name,
        type: entry.isDirectory ? 'directory' : 'file'
      });
    }

    return { items: items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }) };
  } catch (error) {
    return { error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function searchCode(
  pattern: string,
  searchPath: string | undefined,
  filePattern: string | undefined,
  engineRoot: string
): Promise<SearchResult> {
  try {
    const validation = validatePath(searchPath || '.', engineRoot);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const regex = new RegExp(pattern, 'i');
    const matches: Array<{ file: string; line: number; content: string }> = [];

    async function searchDirectory(dir: string, relativePath: string = '') {
      for await (const entry of Deno.readDir(dir)) {
        const entryPath = `${dir}/${entry.name}`;
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory) {
          // Skip common non-code directories
          if (!['node_modules', '.git', '__pycache__', 'venv', '.venv'].includes(entry.name)) {
            await searchDirectory(entryPath, relPath);
          }
        } else if (entry.isFile) {
          // Apply file pattern filter if provided
          if (filePattern && !entry.name.match(new RegExp(filePattern.replace('*', '.*')))) {
            continue;
          }

          try {
            const content = await Deno.readTextFile(entryPath);
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
              if (regex.test(line)) {
                matches.push({
                  file: relPath,
                  line: index + 1,
                  content: line.trim()
                });
              }
            });
          } catch {
            // Skip files that can't be read as text
          }
        }
      }
    }

    await searchDirectory(validation.fullPath);
    return { matches };
  } catch (error) {
    return { error: `Search failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
