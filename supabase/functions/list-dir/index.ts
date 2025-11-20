import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { path } = await req.json();
    const dirPath = path || '.';

    // Validate path - no parent traversal, no absolute paths
    if (dirPath.includes('..') || dirPath.startsWith('/')) {
      console.error('Invalid path attempt:', dirPath);
      return new Response(
        JSON.stringify({ error: "Invalid path: parent traversal not allowed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/rotation-engine';
    const fullPath = dirPath === '.' ? engineRoot : `${engineRoot}/${dirPath}`;

    console.log('Listing directory:', fullPath);

    let entries;
    try {
      entries = [];
      for await (const entry of Deno.readDir(fullPath)) {
        entries.push({
          name: entry.name,
          type: entry.isDirectory ? 'directory' : 'file'
        });
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return new Response(
          JSON.stringify({ error: "Directory not found" }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return new Response(
      JSON.stringify({ entries }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in list-dir:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
