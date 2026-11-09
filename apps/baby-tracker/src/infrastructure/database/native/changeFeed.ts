export type ChangeTopic =
  | 'care'
  | 'sessions'
  | 'drafts'
  | 'revisions'
  | 'profile'
  | 'schema'
  | 'meta'
  | 'attachments'
  | 'projects';

export type ChangeNotification = {
  seq: number;
  publishedAtMs: number;
  topics: readonly ChangeTopic[];
};

export type ChangeFeed = {
  publish(topics: readonly ChangeTopic[], publishedAtMs: number): Promise<ChangeNotification>;
  subscribe(listener: (notification: ChangeNotification) => void): () => void;
};

/**
 * Local in-process change feed. Persistence of the last notification rows lives
 * in SQL; subscribers only see commits that finished successfully.
 */
export function createChangeFeed(): ChangeFeed {
  const listeners = new Set<(notification: ChangeNotification) => void>();
  let seq = 0;
  return {
    async publish(topics, publishedAtMs) {
      seq += 1;
      const notification: ChangeNotification = {
        seq,
        publishedAtMs,
        topics: [...topics],
      };
      for (const listener of listeners) {
        listener(notification);
      }
      return notification;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
