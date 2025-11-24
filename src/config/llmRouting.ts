/**
 * LLM Tier Routing Configuration
 *
 * Defines model selection for different reasoning tiers:
 * - PRIMARY: High-stakes reasoning (code writing, architecture, complex strategy analysis)
 * - SWARM: Agent/specialist workflows (audit, pattern mining, curation, risk review)
 *
 * IMPORTANT: Model names are now centralized in ./models.ts
 * This file re-exports from the centralized config for backwards compatibility.
 */

import { MODELS, type ProviderName as ModelProviderName } from './models';

export type LlmTier = 'primary' | 'secondary' | 'swarm';
export type ProviderName = ModelProviderName;

/**
 * Model configuration for PRIMARY tier
 * Used for: Main chat, final synthesizers, high-stakes reasoning
 */
export const PRIMARY_MODEL = MODELS.PRIMARY.model;
export const PRIMARY_PROVIDER = MODELS.PRIMARY.provider;

/**
 * Model configuration for SECONDARY tier
 * Used for: Alternative high-quality reasoning when PRIMARY is unavailable
 */
export const SECONDARY_MODEL = MODELS.SECONDARY.model;
export const SECONDARY_PROVIDER = MODELS.SECONDARY.provider;

/**
 * Model configuration for SWARM tier
 * Used for: Agent modes, specialist analysis, repetitive workflows
 */
export const SWARM_MODEL = MODELS.SWARM.model;
export const SWARM_PROVIDER = MODELS.SWARM.provider;

/**
 * Get model name for a specific tier
 */
export function getModelForTier(tier: LlmTier): string {
  if (tier === 'primary') return PRIMARY_MODEL;
  if (tier === 'secondary') return SECONDARY_MODEL;
  return SWARM_MODEL;
}

/**
 * Get provider name for a specific tier
 */
export function getProviderForTier(tier: LlmTier): ProviderName {
  if (tier === 'primary') return PRIMARY_PROVIDER;
  if (tier === 'secondary') return SECONDARY_PROVIDER;
  return SWARM_PROVIDER;
}

/**
 * Map of edge function names to their tiers
 */
export const FUNCTION_TIER_MAP: Record<string, LlmTier> = {
  'chat-primary': 'primary',
  'chat-swarm': 'swarm',
};
