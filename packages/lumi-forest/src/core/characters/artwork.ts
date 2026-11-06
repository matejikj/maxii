/**
 * v0.2 compatibility: original artwork, reconstructed 1:1 from the named
 * anatomical parts. The v0.3 anatomy is the single source of geometry.
 */
import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { group } from '../vector/nodes';
import { CHARACTER_ANATOMY } from './anatomy';

export const CHARACTER_ARTWORK: Readonly<Record<LumiAnimal, VectorNode>> = {
  rabbit: group(CHARACTER_ANATOMY.rabbit.map(p => p.geometry)),
  bear: group(CHARACTER_ANATOMY.bear.map(p => p.geometry)),
  fox: group(CHARACTER_ANATOMY.fox.map(p => p.geometry)),
  otter: group(CHARACTER_ANATOMY.otter.map(p => p.geometry)),
  hedgehog: group(CHARACTER_ANATOMY.hedgehog.map(p => p.geometry)),
};
