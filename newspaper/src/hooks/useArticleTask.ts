import { useEffect, useState } from 'react';
import { taskAPI, transformTask } from '../utils/api';
import { Task, TaskStatus } from '../types/Task';

const STATUS_PRIORITY: Record<TaskStatus, number> = {
  open: 0,
  in_progress: 1,
  done: 2,
  cancelled: 3,
};

function pickArticleTask(tasks: Task[]): Task | null {
  if (tasks.length === 0) return null;
  const sorted = [...tasks].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byStatus !== 0) return byStatus;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return sorted[0];
}

export function useArticleTask(articleId: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setTask(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const raw = await taskAPI.getTasks({ limit: 200 });
        const matches = raw
          .map(transformTask)
          .filter(t => !t.isIssueTask && t.articleId === articleId);
        if (!cancelled) {
          setTask(pickArticleTask(matches));
        }
      } catch {
        if (!cancelled) setTask(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  return { task, loading };
}
