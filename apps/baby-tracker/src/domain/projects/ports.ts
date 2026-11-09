import type { ChildId, EntityId } from '../ids';
import type { Project } from './types';

/**
 * Local project rows live in the same private diary DB as care data so wipe
 * and replace clear them together. Private child payloads stay owner-scoped;
 * familyGuided rows are caregiver-visible on this device.
 */
export type ProjectRepository = {
  getById(projectId: EntityId): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(projectId: EntityId): Promise<void>;
  listByChild(childId: ChildId): Promise<Project[]>;
  listAll(): Promise<Project[]>;
  /** Remove every project for one child (scoped diary erase). */
  deleteByChild(childId: ChildId): Promise<number>;
  clearAll(): Promise<void>;
};
