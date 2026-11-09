import type { VectorNode } from '../vector/types';
import { CHARACTER_BLUEPRINTS } from './blueprint';
import { compileCharacter, compileStudioActionStatic } from './compiler';
import { STUDIO_ACTION_IDS, STUDIO_ACTIONS } from './studioCollection';
import type { LumiAnimal } from '../types';

/** Count character vector IR nodes for workshop budget checks (groups included). */
export function countCharacterVectorNodes(node: VectorNode): number {
  if (node.kind !== 'group') return 1;
  return (
    1 + node.children.reduce((sum, child) => sum + countCharacterVectorNodes(child), 0)
  );
}

export type StudioComplexityReport = {
  readonly maxStudioActionNodes: number;
  readonly maxStudioActionProps: number;
  readonly withinWorkshopNodeBudget: boolean;
  readonly withinPropBudget: boolean;
  readonly perAction: readonly {
    readonly actionId: string;
    readonly species: LumiAnimal;
    readonly nodeCount: number;
    readonly propCount: number;
  }[];
};

/** Workshop scenes target ≤240 vector nodes and ≤2 visible props. */
export function measureStudioSceneComplexity(
  nodeBudget = 240,
  propBudget = 2,
): StudioComplexityReport {
  const perAction = STUDIO_ACTION_IDS.map((actionId) => {
    const def = STUDIO_ACTIONS[actionId];
    const node = compileStudioActionStatic(
      CHARACTER_BLUEPRINTS[def.species],
      actionId,
      'workshop',
    );
    return {
      actionId,
      species: def.species,
      nodeCount: node ? countCharacterVectorNodes(node) : 0,
      propCount: def.props.length,
    };
  });
  const maxStudioActionNodes = Math.max(0, ...perAction.map((row) => row.nodeCount));
  const maxStudioActionProps = Math.max(0, ...perAction.map((row) => row.propCount));
  return {
    maxStudioActionNodes,
    maxStudioActionProps,
    withinWorkshopNodeBudget: maxStudioActionNodes <= nodeBudget,
    withinPropBudget: maxStudioActionProps <= propBudget,
    perAction,
  };
}

export function measureForestSittingNodes(species: LumiAnimal): number {
  return countCharacterVectorNodes(
    compileCharacter(CHARACTER_BLUEPRINTS[species], {
      pose: 'sitting',
      expression: 'happy',
      appearanceStyle: 'forest',
    }),
  );
}
