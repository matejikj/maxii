import { LUMI_ICON_IDS, type CompileLumiIconOptions, type IconDocument, type LumiIconId } from './types';
import { buildLumiIconNodes, ICON_SIZE } from './catalog';

function isLumiIconId(value: string): value is LumiIconId {
  return (LUMI_ICON_IDS as readonly string[]).includes(value);
}

/**
 * Compile a monochrome forest UI icon. Fail closed on unknown ids.
 * Output is frozen for referential stability in React trees.
 */
export function compileLumiIcon(id: LumiIconId | string, options: CompileLumiIconOptions): IconDocument {
  if (!isLumiIconId(id)) {
    throw new RangeError(`Unknown Lumi icon id: ${String(id)}`);
  }
  const color = options.color;
  if (typeof color !== 'string' || color.length === 0) {
    throw new RangeError('compileLumiIcon requires a non-empty color');
  }
  const document: IconDocument = {
    schemaVersion: 1,
    id,
    width: ICON_SIZE,
    height: ICON_SIZE,
    nodes: buildLumiIconNodes(id, color),
  };
  return Object.freeze(document);
}

export function isKnownLumiIconId(value: string): value is LumiIconId {
  return isLumiIconId(value);
}
