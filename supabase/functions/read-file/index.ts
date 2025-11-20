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

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Path is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate path - no parent traversal, no absolute paths
    if (path.includes('..') || path.startsWith('/')) {
      console.error('Invalid path attempt:', path);
      return new Response(
        JSON.stringify({ error: "Invalid path: parent traversal not allowed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/rotation-engine';
    const fullPath = `${engineRoot}/${path}`;

    console.log('Reading file:', fullPath);

    let content: string;
    try {
      content = await Deno.readTextFile(fullPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return new Response(
          JSON.stringify({ error: "File not found" }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Truncate very large files
    const MAX_SIZE = 100000; // 100KB
    if (content.length > MAX_SIZE) {
      console.log('Truncating large file:', path, 'size:', content.length);
      content = content.substring(0, MAX_SIZE) + '\n\n[... file truncated due to size ...]';
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in read-file:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
