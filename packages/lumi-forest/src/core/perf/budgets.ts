/** Engineering targets, not a claim that any physical device has passed them. */
export const LUMI_PERFORMANCE_BUDGETS = {
  maxVectorNodesPerScene: 110,
  maxDecorations: 21,
  targetRefreshHz: 60,
  goalComposeP95MsOnMidRangeDevice: 3,
  goalJsFrameIntervalP95Ms: 20,
  goalNativeJankyFramesPercent: 3,
  goalSceneTransitionP95Ms: 500,
  goalAdditionalMemoryMegabytes: 8,
  maxProceduralVectorNodes: 250,
  maxProceduralPlacedItems: 52,
  maxProceduralPlacementAttemptsPerItem: 35,
  /** Workshop scene IR budget — measured offline in software; device p95 still separate. */
  maxWorkshopActionVectorNodes: 240,
  maxWorkshopVisibleProps: 2,
} as const;

import type { VectorNode, SceneDocument } from '../vector/types';
export function countVectorNodes(document: SceneDocument): number {
  const count = (node: VectorNode): number => 1 + (node.kind === 'group' ? node.children.reduce((sum, child) => sum + count(child), 0) : 0);
  return document.layers.reduce((sum, layer) => sum + layer.nodes.reduce((n, item) => n + count(item), 0), 0);
}
