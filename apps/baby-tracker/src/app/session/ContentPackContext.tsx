import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  activateEmbeddedFirstYearBase,
  type ContentReadiness,
  type MemoryPackStore,
} from '../../content/pack';
import { useCompositionRoot } from '../providers';

type ContentPackContextValue = {
  readonly store: MemoryPackStore | null;
  readonly readiness: ContentReadiness;
  readonly activationError: string | null;
};

const ContentPackContext = createContext<ContentPackContextValue | null>(null);

/**
 * Activates the signed install-local content pack once per session. Tracker
 * care stays available even when readiness is limited/unavailable.
 */
export function ContentPackProvider({ children }: { children: ReactNode }) {
  const { services } = useCompositionRoot();
  const value = useMemo<ContentPackContextValue>(() => {
    try {
      const activated = activateEmbeddedFirstYearBase(services.clock.now().epochMs);
      return {
        store: activated.store,
        readiness: activated.readiness,
        activationError: null,
      };
    } catch (error) {
      return {
        store: null,
        readiness: {
          status: 'unavailable',
          reason: error instanceof Error ? error.message : 'Content pack unavailable',
          activePackId: null,
          activeGeneration: null,
          catalogVersion: null,
          collectionVersion: null,
          checkedAtMs: services.clock.now().epochMs,
        },
        activationError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [services.clock]);

  return <ContentPackContext.Provider value={value}>{children}</ContentPackContext.Provider>;
}

export function useContentPack(): ContentPackContextValue {
  const value = useContext(ContentPackContext);
  if (!value) {
    throw new Error('useContentPack requires ContentPackProvider');
  }
  return value;
}
