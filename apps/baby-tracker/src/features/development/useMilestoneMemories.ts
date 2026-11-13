import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChildId, MilestoneCareEvent } from '../../domain';
import { listMilestoneMemories } from '../../application/milestones';
import { usePersonalRuntime } from '../../app/session/BootstrapContext';

export function useMilestoneMemories(childId: ChildId, active: boolean) {
  const runtime = usePersonalRuntime();
  const generation = useRef(0);
  const [events, setEvents] = useState<MilestoneCareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const next = await listMilestoneMemories(runtime.unitOfWork, childId);
      if (request === generation.current) setEvents(next);
    } catch {
      if (request === generation.current) setError('Vzpomínky se nepodařilo načíst. Zkuste to znovu.');
    } finally { if (request === generation.current) setLoading(false); }
  }, [childId, runtime.unitOfWork]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void reload(); });
    const unsubscribe = runtime.readModels.subscribe((topics) => {
      if (topics.includes('care')) void reload();
    });
    return () => { disposed = true; invalidateRequests(); unsubscribe(); };
  }, [active, invalidateRequests, reload, runtime.readModels]);
  return { events, loading, error, reload };
}
