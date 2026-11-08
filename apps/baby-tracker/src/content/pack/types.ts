import type { ContentFileKind, ContentPackKind } from './limits';

export type ContentPackFileEntry = {
  readonly logicalId: string;
  readonly kind: ContentFileKind;
  readonly mime: string;
  readonly byteLength: number;
  readonly sha256: string;
};

export type ContentPackManifest = {
  readonly format: 'lumi.content-pack.v1';
  readonly packId: string;
  readonly kind: ContentPackKind;
  readonly generation: number;
  readonly readerVersion: string;
  readonly catalogVersion: string;
  readonly collectionVersion: string;
  readonly rulesVersion: string;
  readonly language: 'cs';
  readonly ageMonths: { readonly fromInclusive: number; readonly toInclusive: number };
  readonly activityRevisionIds: readonly string[];
  readonly capabilities: readonly string[];
  readonly files: readonly ContentPackFileEntry[];
  readonly totalBytes: number;
  readonly createdAt: string;
};

export type ContentPackSignature = {
  readonly format: 'lumi.content-pack-signature.v1';
  readonly algorithm: 'Ed25519';
  readonly keyId: string;
  /** Base64url (no padding) signature over the JCS UTF-8 manifest bytes. */
  readonly signature: string;
};

export type ContentPackFileBytes = {
  readonly logicalId: string;
  readonly bytes: Uint8Array;
};

export type TrustedPublicKey = {
  readonly keyId: string;
  /** 32-byte Ed25519 public key, hex. */
  readonly publicKeyHex: string;
  readonly purpose: 'production' | 'development';
};

export type PackActivationState =
  | 'absent'
  | 'staging'
  | 'verified'
  | 'active'
  | 'rejected'
  | 'previous';

export type PackStoreRecord = {
  readonly packId: string;
  readonly generation: number;
  readonly state: PackActivationState;
  readonly manifest: ContentPackManifest;
  readonly signature: ContentPackSignature;
  readonly keyId: string;
  readonly activatedAtMs: number | null;
  readonly rejectReason: string | null;
};

export type ContentReadinessStatus = 'preparing' | 'ready' | 'limited' | 'unavailable';

export type ContentReadiness = {
  readonly status: ContentReadinessStatus;
  readonly reason: string;
  readonly activePackId: string | null;
  readonly activeGeneration: number | null;
  readonly catalogVersion: string | null;
  readonly collectionVersion: string | null;
  readonly checkedAtMs: number;
};
