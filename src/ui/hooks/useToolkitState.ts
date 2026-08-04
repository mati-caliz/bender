import { useCallback, useEffect, useState } from 'react';
import { createDefaultState } from '@/lib/constants';
import { readState, subscribeToState, writeState } from '@/lib/state';
import type { ToolkitState } from '@/types';

export interface ToolkitStore {
  state: ToolkitState;
  ready: boolean;
  update: (mutate: (state: ToolkitState) => ToolkitState) => void;
}

export const useToolkitState = (): ToolkitStore => {
  const [state, setState] = useState<ToolkitState>(createDefaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void readState().then((stored) => {
      if (!active) return;
      setState(stored);
      setReady(true);
    });
    const unsubscribe = subscribeToState((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback((mutate: (current: ToolkitState) => ToolkitState) => {
    setState((current) => {
      const next = mutate(current);
      void writeState(next);
      return next;
    });
  }, []);

  return { state, ready, update };
};
