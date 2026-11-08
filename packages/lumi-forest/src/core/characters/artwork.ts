/**
 * v0.2 compatibility: original artwork, reconstructed 1:1 from the named
 * anatomical parts. The v0.3 anatomy is the single source of geometry.
 */
import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { group } from '../vector/nodes';
import { CHARACTER_ANATOMY } from './anatomy';
import { LUMI_ANIMALS } from '../types';

export const CHARACTER_ARTWORK: Readonly<Record<LumiAnimal, VectorNode>> = Object.fromEntries(
  LUMI_ANIMALS.map((species) => [species, group(CHARACTER_ANATOMY[species].map((p) => p.geometry))]),
) as Readonly<Record<LumiAnimal, VectorNode>>;
