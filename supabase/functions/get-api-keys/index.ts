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
    // Read API keys from Supabase environment
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';

    return new Response(
      JSON.stringify({
        gemini: geminiKey,
        openai: openaiKey,
        deepseek: deepseekKey,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch API keys' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
