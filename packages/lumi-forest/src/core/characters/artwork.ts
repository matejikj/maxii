/**
 * Compatibility façade reconstructed from the current named anatomical parts.
 * Anatomy remains the single source of geometry across all renderers.
 */
import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { group } from '../vector/nodes';
import { CHARACTER_ANATOMY } from './anatomy';
import { LUMI_ANIMALS } from '../types';

export const CHARACTER_ARTWORK: Readonly<Record<LumiAnimal, VectorNode>> = Object.fromEntries(
  LUMI_ANIMALS.map((species) => [species, group(CHARACTER_ANATOMY[species].map((p) => p.geometry))]),
) as Readonly<Record<LumiAnimal, VectorNode>>;
