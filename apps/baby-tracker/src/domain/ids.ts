/**
 * Opaque identifiers keep care records unlinkable from birth dates and clocks.
 * Prefixes are only for debugging; identity itself is random.
 */
export type ChildId = string & { readonly __brand: 'ChildId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type RevisionId = string & { readonly __brand: 'RevisionId' };
export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type ActorId = string & { readonly __brand: 'ActorId' };

export function asChildId(value: string): ChildId {
  return value as ChildId;
}

export function asEntityId(value: string): EntityId {
  return value as EntityId;
}

export function asOperationId(value: string): OperationId {
  return value as OperationId;
}

export function asRevisionId(value: string): RevisionId {
  return value as RevisionId;
}

export function asDeviceId(value: string): DeviceId {
  return value as DeviceId;
}

export function asActorId(value: string): ActorId {
  return value as ActorId;
}
