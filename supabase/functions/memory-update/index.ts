import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { generateEmbedding } from '../_shared/embeddings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noteId, content, memoryType, importance, tags, archived } = await req.json();

    if (!noteId) {
      return new Response(
        JSON.stringify({ error: 'noteId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate memory_type and importance if provided
    const validTypes = ['insight', 'rule', 'warning', 'todo', 'bug', 'profile_change'];
    const validImportance = ['low', 'normal', 'high', 'critical'];
    
    if (memoryType && !validTypes.includes(memoryType)) {
      return new Response(
        JSON.stringify({ error: `Invalid memory_type. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (importance && !validImportance.includes(importance)) {
      return new Response(
        JSON.stringify({ error: `Invalid importance. Must be one of: ${validImportance.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating memory note ${noteId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch existing note to get previous content and embedding
    const { data: existingNote, error: fetchError } = await supabase
      .from('memory_notes')
      .select('*')
      .eq('id', noteId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing note:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch note for update' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingNote) {
      return new Response(
        JSON.stringify({ error: 'Note not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: any = {};

    if (content !== undefined) {
      updateData.content = content.trim();
      
      // If content changed, try to regenerate embedding
      if (content.trim() !== existingNote.content) {
        console.log('Content changed, regenerating embedding...');
        const newEmbedding = await generateEmbedding(content.trim());
        
        if (newEmbedding) {
          updateData.embedding = newEmbedding;
        } else {
          console.warn('Failed to regenerate embedding, keeping previous embedding if exists');
          // Keep existing embedding by not updating it
        }
      }
    }

    if (memoryType !== undefined) {
      updateData.memory_type = memoryType;
    }

    if (importance !== undefined) {
      updateData.importance = importance;
    }

    if (tags !== undefined) {
      updateData.tags = tags;
    }

    if (archived !== undefined) {
      updateData.archived = archived;
    }

    // updated_at will be set automatically by trigger

    // Update memory note
    const { data, error } = await supabase
      .from('memory_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory note:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update memory note' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Memory note updated: ${data.id}`);

    return new Response(
      JSON.stringify({ success: true, note: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in memory-update function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
