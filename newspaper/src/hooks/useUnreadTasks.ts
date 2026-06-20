import { useCallback, useEffect, useState } from 'react';
import { taskAPI, transformTask } from '../utils/api';
import { useAuth } from '../contexts/AuthContexts';

export function useUnreadTasks() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const storageKey = `seen_tasks_${user?.id}`;

  const getSeenIds = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  }, [storageKey]);

  const check = useCallback(async () => {
    if (!user) return;
    try {
      const raw = await taskAPI.getTasks({ limit: 200 });
      const tasks = raw.map(transformTask).filter(
        t => t.status !== 'done' && t.status !== 'cancelled'
      );
      const seen = getSeenIds();
      const unseen = tasks.filter(t => !seen.has(t.id));
      setUnreadCount(unseen.length);
    } catch {}
  }, [user, getSeenIds]);

  const markAllSeen = useCallback(async () => {
    if (!user) return;
    try {
      const raw = await taskAPI.getTasks({ limit: 200 });
      const ids = raw.map(t => t._id);
      const seen = getSeenIds();
      ids.forEach(id => seen.add(id));
      localStorage.setItem(storageKey, JSON.stringify(Array.from(seen)));
      setUnreadCount(0);
    } catch {}
  }, [user, getSeenIds, storageKey]);

  useEffect(() => {
    void check();
    const interval = setInterval(() => void check(), 30_000);
    return () => clearInterval(interval);
  }, [check]);

  return { unreadCount, markAllSeen, refresh: check };
}
