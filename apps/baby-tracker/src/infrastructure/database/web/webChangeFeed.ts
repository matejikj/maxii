import type { ChangeNotification, ChangeTopic } from '../native/changeFeed';

export type WebDiaryChangeMessage = {
  type: 'committed';
  seq: number;
  publishedAtMs: number;
  topics: ChangeTopic[];
  dataVersion: number;
  /** True when another tab changed durable state; UI must keep open draft text. */
  preserveOpenDraft: true;
};

export type WebChangeFeed = {
  publish(
    topics: readonly ChangeTopic[],
    publishedAtMs: number,
    dataVersion: number,
  ): Promise<ChangeNotification & { dataVersion: number }>;
  subscribe(listener: (message: WebDiaryChangeMessage) => void): () => void;
  close(): void;
};

type ChannelLike = {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
};

/**
 * BroadcastChannel notifies other tabs after a successful IndexedDB commit.
 * It never authorizes writes — leases and transactions remain the source of truth.
 */
export function createWebChangeFeed(options: {
  channelName?: string;
  createChannel?: (name: string) => ChannelLike;
} = {}): WebChangeFeed {
  const channelName = options.channelName ?? 'lumi-web-diary-changes';
  const listeners = new Set<(message: WebDiaryChangeMessage) => void>();
  let seq = 0;

  let channel: ChannelLike | null = null;
  if (typeof BroadcastChannel !== 'undefined' || options.createChannel) {
    const factory =
      options.createChannel ?? ((name: string) => new BroadcastChannel(name) as ChannelLike);
    channel = factory(channelName);
    channel.addEventListener('message', (event) => {
      const data = event.data as WebDiaryChangeMessage | undefined;
      if (data?.type !== 'committed') return;
      for (const listener of listeners) listener(data);
    });
  }

  return {
    async publish(topics, publishedAtMs, dataVersion) {
      seq += 1;
      const notification = {
        seq,
        publishedAtMs,
        topics: [...topics] as ChangeTopic[],
        dataVersion,
      };
      const message: WebDiaryChangeMessage = {
        type: 'committed',
        ...notification,
        preserveOpenDraft: true,
      };
      channel?.postMessage(message);
      for (const listener of listeners) listener(message);
      return notification;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      channel?.close();
      channel = null;
      listeners.clear();
    },
  };
}
