/**
 * Migrate LESSONS_LEARNED.md to Supabase as LEVEL 0 protected memories
 *
 * This is a one-time migration script to convert critical lessons
 * into protected memories that can never be forgotten.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const LESSONS_LEARNED_PATH = '/Users/zstoc/.claude/LESSONS_LEARNED.md';

interface Lesson {
  number: number;
  title: string;
  content: string;
  cost: string;
  triggers: string[];
  severity: string;
  dateLearn: string;
  financialImpact: number;
}

async function parseLessonsLearned(): Promise<Lesson[]> {
  let content: string;

  try {
    content = fs.readFileSync(LESSONS_LEARNED_PATH, 'utf-8');
  } catch (error) {
    console.error(`Failed to read ${LESSONS_LEARNED_PATH}:`, error);
    throw error;
  }

  const lessons: Lesson[] = [];

  // Split by lesson headers
  const lessonBlocks = content.split(/## LESSON \d+:/);

  for (const block of lessonBlocks.slice(1)) { // Skip header
    const lines = block.split('\n');
    const title = lines[0].trim();

    // Extract components
    const costMatch = block.match(/\*\*Cost\*\*:\n(.*?)(?=\n\n|\*\*)/s);
    const triggersMatch = block.match(/\*\*Trigger Phrases\*\*.*?\n(.*?)(?=\n\n|\*\*)/s);
    const dateMatch = block.match(/\*\*Date Learned\*\*:\s*(\d{4}-\d{2}-\d{2})/);
    const severityMatch = block.match(/\*\*Severity\*\*:\s*🔴\s*(.*)/);

    // Estimate financial impact from cost section
    let financialImpact = 0;
    if (costMatch) {
      const costText = costMatch[1];

      // Parse $ amounts
      const dollarMatch = costText.match(/\$(\d+(?:,\d+)?)/);
      if (dollarMatch) {
        financialImpact = parseInt(dollarMatch[1].replace(/,/g, ''));
      }

      // Parse hours
      const hoursMatch = costText.match(/(\d+)\s*HOURS?/i);
      if (hoursMatch) {
        financialImpact += parseInt(hoursMatch[1]) * 200; // $200/hour opportunity cost
      }
    }

    // Extract trigger phrases
    const triggers: string[] = [];
    if (triggersMatch) {
      const triggerText = triggersMatch[1];
      const matches = triggerText.matchAll(/"([^"]+)"/g);
      for (const match of matches) {
        triggers.push(match[1].toLowerCase());
      }
    }

    // Validate required fields
    if (!title.trim()) {
      console.warn(`Skipping lesson with empty title at index ${lessons.length}`);
      continue;
    }
    if (!costMatch) {
      console.warn(`Lesson "${title}" missing cost section`);
    }

    lessons.push({
      number: lessons.length + 1,
      title,
      content: block.trim(),
      cost: costMatch?.[1] || 'Unknown cost',
      triggers,
      severity: severityMatch?.[1] || 'CRITICAL',
      dateLearn: dateMatch?.[1] || '2025-11-14',
      financialImpact
    });
  }

  return lessons;
}

async function migrateLessons() {
  // Validate environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Get default workspace (single user)
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1);

  if (wsError) {
    throw new Error(`Supabase error: ${wsError.message}`);
  }
  if (!workspaces || workspaces.length === 0) {
    throw new Error('No workspace found. Create a workspace first.');
  }

  const workspaceId = workspaces[0].id;
  const lessons = await parseLessonsLearned();

  // Check if lessons already migrated
  const { data: existing, error: checkError } = await supabase
    .from('memories')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('category', 'lessons_learned')
    .limit(1);

  if (checkError) {
    throw new Error(`Error checking existing migrations: ${checkError.message}`);
  }
  if (existing && existing.length > 0) {
    console.log('Lessons already migrated. Skipping...');
    return;
  }

  console.log(`Migrating ${lessons.length} lessons to LEVEL 0 protected memories...`);

  let succeeded = 0;
  let failed = 0;

  for (const lesson of lessons) {
    const memory = {
      workspace_id: workspaceId,
      content: lesson.content,
      summary: lesson.title,
      memory_type: 'rule',
      importance_score: 1.0, // Maximum

      // PROTECTION LEVEL 0 - IMMUTABLE
      protection_level: 0,
      immutable: true,
      financial_impact: lesson.financialImpact,

      category: 'lessons_learned',
      tags: ['critical', 'lessons_learned', `lesson_${lesson.number}`, ...lesson.triggers.slice(0, 3)],
      source: 'migration',
      confidence: 1.0,

      regime_context: {
        source: 'lessons_learned_md',
        date_learned: lesson.dateLearn,
        severity: lesson.severity
      }
    };

    const { error } = await supabase.from('memories').insert(memory);

    if (error) {
      console.error(`Failed to migrate lesson ${lesson.number}:`, error);
      failed++;
    } else {
      console.log(`✓ Migrated: ${lesson.title}`);
      succeeded++;
    }
  }

  console.log(`\nMigration Summary: ${succeeded}/${lessons.length} succeeded, ${failed} failed`);
}

migrateLessons().catch(console.error);
