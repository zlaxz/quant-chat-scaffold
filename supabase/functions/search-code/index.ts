import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { join } from "https://deno.land/std@0.168.0/path/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  file: string;
  line: number;
  context: string;
}

async function searchInFile(filePath: string, query: string, relativePath: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split('\n');
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        results.push({
          file: relativePath,
          line: index + 1,
          context: line.trim()
        });
      }
    });
  } catch (error) {
    // Skip files that can't be read (permissions, binary, etc.)
    console.log('Skipping file:', relativePath, error);
  }

  return results;
}

async function searchRecursive(
  dirPath: string,
  query: string,
  engineRoot: string,
  maxResults = 100
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const codeExtensions = ['.py', '.js', '.ts', '.json', '.yaml', '.yml', '.toml', '.md'];

  try {
    for await (const entry of Deno.readDir(dirPath)) {
      if (results.length >= maxResults) break;

      const fullPath = join(dirPath, entry.name);
      const relativePath = fullPath.replace(engineRoot + '/', '');

      if (entry.isDirectory) {
        // Skip common non-code directories
        if (['.git', '__pycache__', 'node_modules', '.venv', 'venv'].includes(entry.name)) {
          continue;
        }
        const subResults = await searchRecursive(fullPath, query, engineRoot, maxResults - results.length);
        results.push(...subResults);
      } else if (entry.isFile) {
        // Only search code files
        const hasCodeExtension = codeExtensions.some(ext => entry.name.endsWith(ext));
        if (hasCodeExtension) {
          const fileResults = await searchInFile(fullPath, query, relativePath);
          results.push(...fileResults.slice(0, maxResults - results.length));
        }
      }
    }
  } catch (error) {
    console.error('Error searching directory:', dirPath, error);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, path } = await req.json();

    if (!query || query.trim() === '') {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchPath = path || '.';

    // Validate path - no parent traversal, no absolute paths
    if (searchPath.includes('..') || searchPath.startsWith('/')) {
      console.error('Invalid path attempt:', searchPath);
      return new Response(
        JSON.stringify({ error: "Invalid path: parent traversal not allowed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/rotation-engine';
    const fullPath = searchPath === '.' ? engineRoot : `${engineRoot}/${searchPath}`;

    console.log('Searching code in:', fullPath, 'for query:', query);

    const results = await searchRecursive(fullPath, query, engineRoot);

    console.log('Search complete. Found', results.length, 'results');

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-code:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
