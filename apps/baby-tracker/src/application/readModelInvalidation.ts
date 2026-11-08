/**
 * Read models (Today, Care, later Development) must refresh from committed
 * storage topics — never from an independent cache copy of care state.
 */
export type ReadModelTopic = 'care' | 'sessions' | 'drafts' | 'revisions' | 'profile' | 'schema';

export type ReadModelInvalidator = {
  /** Subscribe after a successful dispatch; listeners run only for committed topics. */
  subscribe(listener: (topics: readonly ReadModelTopic[]) => void): () => void;
  notifyCommitted(topics: readonly ReadModelTopic[]): void;
};

export function createReadModelInvalidator(): ReadModelInvalidator {
  const listeners = new Set<(topics: readonly ReadModelTopic[]) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notifyCommitted(topics) {
      if (topics.length === 0) return;
      for (const listener of listeners) listener(topics);
    },
  };
}
