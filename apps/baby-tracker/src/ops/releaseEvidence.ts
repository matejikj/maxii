import { LOCAL_LIBRARY_CONTENT_VERSION } from '../content/localLibrary';
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

export type ReleaseEvidenceManifest = {
  format: typeof RELEASE_EVIDENCE_FORMAT;
  generatedAtMs: number;
  environment: 'development' | 'staging' | 'production';
  app: {
    name: string;
    version: string;
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
  };
  art: {
    /** Forest design package version doubles as the shipped art collection id. */
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
  artCollectionVersion?: string;
  catalogVersion?: string;
};

export function buildReleaseEvidenceManifest(
  input: ReleaseEvidenceInput,
): ReleaseEvidenceManifest {
  return {
    format: RELEASE_EVIDENCE_FORMAT,
    generatedAtMs: input.nowMs,
    environment: input.environment,
    app: {
      name: input.appName ?? 'LUMI Baby Tracker',
      version: input.appVersion ?? '0.1.0',
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
      catalogVersion: input.catalogVersion ?? LOCAL_LIBRARY_CONTENT_VERSION,
      recommendationRulesVersion: RECOMMENDATION_RULES_VERSION,
    },
    art: {
      collectionVersion: input.artCollectionVersion ?? '1.0.0',
    },
    signing: {
      keysInRepository: false,
      note: 'Store signing keys and CI secrets are held outside git with role-limited access.',
    },
  };
}
