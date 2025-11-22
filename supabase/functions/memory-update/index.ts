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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'CONFIG_ERROR', message: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
        JSON.stringify({ error: 'DATABASE_ERROR', message: 'Failed to fetch note for update' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingNote) {
      return new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Note not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object with audit tracking
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (content !== undefined && content !== null) {
      const trimmedContent = String(content).trim();
      if (!trimmedContent) {
        return new Response(
          JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Content cannot be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      updateData.content = trimmedContent;
      changedFields.push('content');
      
      // If content changed, try to regenerate embedding
      if (trimmedContent !== existingNote.content) {
        console.log('Content changed, regenerating embedding...');
        const newEmbedding = await generateEmbedding(trimmedContent);
        
        if (newEmbedding) {
          updateData.embedding = newEmbedding;
          changedFields.push('embedding');
        } else {
          console.warn('Failed to regenerate embedding, keeping previous embedding if exists');
          // Keep existing embedding by not updating it
        }
      }
    }

    if (memoryType !== undefined) {
      updateData.memory_type = memoryType;
      changedFields.push('memory_type');
    }

    if (importance !== undefined) {
      updateData.importance = importance;
      changedFields.push('importance');
    }

    if (tags !== undefined) {
      updateData.tags = tags;
      changedFields.push('tags');
    }

    if (archived !== undefined) {
      updateData.archived = archived;
      changedFields.push('archived');
    }

    // Log audit trail
    console.log(`Updating note ${noteId}: changed fields = ${changedFields.join(', ')}`);

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
        JSON.stringify({ error: 'DATABASE_ERROR', message: 'Failed to update memory note' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Memory note updated: ${data.id} (changed: ${changedFields.join(', ')})`);

    return new Response(
      JSON.stringify({ success: true, note: data, changedFields }),
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
