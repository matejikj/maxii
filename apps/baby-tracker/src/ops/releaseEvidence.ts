import {
  FIRST_YEAR_PUBLISHED_CONTENT_VERSION,
  FIRST_YEAR_PUBLISHED_REVISIONS,
} from '../content/catalog/firstYearPublished';
import {
  EMBEDDED_BASE_PACK_ID,
  EMBEDDED_COLLECTION_VERSION,
  describeEmbeddedBasePack,
} from '../content/pack/embeddedBase';
import { EMBEDDED_FIRST_YEAR_BASE_SIGNATURE } from '../content/pack/embeddedFirstYearBase';
import { WEB_SCHEMA_VERSION } from '../infrastructure/database/web/lumiWebDatabase';
import { SCHEMA_VERSION_4 } from '../infrastructure/database/native/schema/v4';
import { RECOMMENDATION_RULES_VERSION } from '../domain/recommendation/types';

/**
 * Single release evidence document for personal builds. Versions here are the
 * source of truth for support reports and rollback gates — not store secrets.
 */
export const RELEASE_EVIDENCE_FORMAT = 'lumi.release-evidence.v1' as const;

/** Highest DB schema this binary knows how to open safely. */
export const NATIVE_SCHEMA_COMPATIBILITY = SCHEMA_VERSION_4;
export const WEB_SCHEMA_COMPATIBILITY = WEB_SCHEMA_VERSION;

/** Stable application id for iOS and Android personal installs. */
export const PERSONAL_APPLICATION_ID = 'com.matejikj' as const;

export type ReleaseEvidenceManifest = {
  format: typeof RELEASE_EVIDENCE_FORMAT;
  generatedAtMs: number;
  environment: 'development' | 'staging' | 'production';
  app: {
    name: string;
    version: string;
    applicationId: typeof PERSONAL_APPLICATION_ID;
  };
  runtime: {
    /** Expo SDK major line the app targets. */
    expoSdk: string;
    reactNative: string;
  };
  storage: {
    nativeSchemaCompatibility: number;
    webSchemaCompatibility: number;
  };
  content: {
    catalogVersion: string;
    recommendationRulesVersion: string;
    publishedRevisionCount: number;
  };
  pack: {
    packId: string;
    generation: number;
    readerVersion: string;
    keyId: string;
  };
  art: {
    collectionVersion: string;
  };
  /** Signing keys and store credentials stay outside the repository. */
  signing: {
    keysInRepository: false;
    note: string;
  };
};

export type ReleaseEvidenceInput = {
  nowMs: number;
  environment: ReleaseEvidenceManifest['environment'];
  appName?: string;
  appVersion?: string;
  expoSdk?: string;
  reactNative?: string;
};

export function buildReleaseEvidenceManifest(
  input: ReleaseEvidenceInput,
): ReleaseEvidenceManifest {
  const pack = describeEmbeddedBasePack();
  return {
    format: RELEASE_EVIDENCE_FORMAT,
    generatedAtMs: input.nowMs,
    environment: input.environment,
    app: {
      name: input.appName ?? 'LUMI Baby Tracker',
      version: input.appVersion ?? '0.1.0',
      applicationId: PERSONAL_APPLICATION_ID,
    },
    runtime: {
      expoSdk: input.expoSdk ?? '58',
      reactNative: input.reactNative ?? '0.88.1',
    },
    storage: {
      nativeSchemaCompatibility: NATIVE_SCHEMA_COMPATIBILITY,
      webSchemaCompatibility: WEB_SCHEMA_COMPATIBILITY,
    },
    content: {
      catalogVersion: FIRST_YEAR_PUBLISHED_CONTENT_VERSION,
      recommendationRulesVersion: RECOMMENDATION_RULES_VERSION,
      publishedRevisionCount: FIRST_YEAR_PUBLISHED_REVISIONS.length,
    },
    pack: {
      packId: EMBEDDED_BASE_PACK_ID,
      generation: pack.generation,
      readerVersion: pack.readerVersion,
      keyId: EMBEDDED_FIRST_YEAR_BASE_SIGNATURE.keyId,
    },
    art: {
      collectionVersion: EMBEDDED_COLLECTION_VERSION,
    },
    signing: {
      keysInRepository: false,
      note: 'Store signing keys and CI secrets are held outside git with role-limited access.',
    },
  };
}
