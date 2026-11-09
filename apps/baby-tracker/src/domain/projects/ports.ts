import type { ChildId, EntityId } from '../ids';
import type { PortfolioItem, Project, ShareSnapshot } from './types';

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

export type PortfolioRepository = {
  getById(portfolioItemId: EntityId): Promise<PortfolioItem | null>;
  save(item: PortfolioItem): Promise<void>;
  delete(portfolioItemId: EntityId): Promise<void>;
  listByChild(childId: ChildId): Promise<PortfolioItem[]>;
  listByProject(projectId: EntityId): Promise<PortfolioItem[]>;
  listAll(): Promise<PortfolioItem[]>;
  deleteByChild(childId: ChildId): Promise<number>;
  clearAll(): Promise<void>;
};

export type ShareRepository = {
  getById(shareId: EntityId): Promise<ShareSnapshot | null>;
  save(share: ShareSnapshot): Promise<void>;
  listByOwner(ownerAppUserId: string): Promise<ShareSnapshot[]>;
  listBySourceProject(projectId: EntityId): Promise<ShareSnapshot[]>;
  listAll(): Promise<ShareSnapshot[]>;
  /** Revoke every active share derived from a deleted project. */
  revokeAllForProject(projectId: EntityId, revokedAtMs: number): Promise<number>;
  clearAll(): Promise<void>;
};
