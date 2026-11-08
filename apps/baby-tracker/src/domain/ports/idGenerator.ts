/**
 * Entity and operation identifiers must be opaque and clock-independent so
 * offline devices never collide because of skewed time.
 */
export type IdGenerator = {
  createId(prefix?: string): string;
};
