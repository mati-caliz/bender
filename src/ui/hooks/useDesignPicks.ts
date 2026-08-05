import { useCallback, useEffect, useState } from 'react';
import { readDesignPicks, subscribeToDesignPicks, writeDesignPicks } from '@/lib/design-picks';
import type { DesignPick } from '@/types';

export interface DesignPicksController {
  picks: DesignPick[];
  remove: (id: string) => void;
  clear: () => void;
}

export const useDesignPicks = (): DesignPicksController => {
  const [picks, setPicks] = useState<DesignPick[]>([]);

  useEffect(() => {
    void readDesignPicks().then(setPicks);
    return subscribeToDesignPicks(setPicks);
  }, []);

  const remove = useCallback(
    (id: string) => {
      void writeDesignPicks(picks.filter((pick) => pick.id !== id));
    },
    [picks]
  );

  const clear = useCallback(() => {
    void writeDesignPicks([]);
  }, []);

  return { picks, remove, clear };
};
