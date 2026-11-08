import { FIRST_YEAR_PUBLISHED_REVISIONS } from '../catalog/firstYearPublished';
import { buildContentPackManifest } from './buildManifest';
import { utf8Bytes } from './canonicalize';
import { describeEmbeddedBasePack } from './embeddedBase';
import { listInstalledArtCapabilities } from './capabilities';
import type { ContentPackFileBytes, ContentPackManifest } from './types';

/** Deterministic payload bytes for the install-local first-year base pack. */
export function buildFirstYearBaseFiles(): ContentPackFileBytes[] {
  const meta = describeEmbeddedBasePack();
  const catalogPayload = {
    contentVersion: meta.catalogVersion,
    revisions: FIRST_YEAR_PUBLISHED_REVISIONS,
  };
  const capabilitiesPayload = {
    collectionVersion: meta.collectionVersion,
    capabilities: listInstalledArtCapabilities(),
  };
  return [
    {
      logicalId: 'catalog/first-year.json',
      bytes: utf8Bytes(`${JSON.stringify(catalogPayload)}\n`),
    },
    {
      logicalId: 'art/capabilities.json',
      bytes: utf8Bytes(`${JSON.stringify(capabilitiesPayload)}\n`),
    },
  ];
}

export function buildFirstYearBaseManifest(
  files: ContentPackFileBytes[],
  createdAt: string,
): { manifest: ContentPackManifest; files: ContentPackFileBytes[] } {
  const meta = describeEmbeddedBasePack();
  return buildContentPackManifest({
    packId: meta.packId,
    kind: 'base',
    generation: meta.generation,
    catalogVersion: meta.catalogVersion,
    collectionVersion: meta.collectionVersion,
    rulesVersion: meta.rulesVersion,
    ageMonths: { fromInclusive: 0, toInclusive: 11 },
    activityRevisionIds: FIRST_YEAR_PUBLISHED_REVISIONS.map((item) => item.revisionId),
    capabilities: listInstalledArtCapabilities(),
    files,
    createdAt,
  });
}
