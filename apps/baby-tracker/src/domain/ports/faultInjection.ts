/**
 * Test-only hooks that force storage or crypto failures without mocking every
 * repository. Production composition roots leave this port inert.
 */
export type FaultKind = 'storage_commit' | 'keystore_read' | 'network';

export type FaultInjection = {
  shouldFail(kind: FaultKind): boolean;
};
