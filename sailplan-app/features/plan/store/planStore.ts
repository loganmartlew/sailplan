import { useMemo } from 'react';
import { create } from 'zustand';
import { useBoatProfile } from '~/features/boatProfile';

interface PlanState {
  tws: number | null;
  twd: number | null;
}

interface PlanStore {
  states: Record<number, PlanState>;
  addState: (boatProfileId: number, state: Partial<PlanState>) => void;
}

const usePlanStore = create<PlanStore>((set, get) => ({
  states: {},
  addState: (boatProfileId, state) => {
    const correctedState: PlanState = {
      twd:
        state.twd === undefined ? get().states[boatProfileId]?.twd : state.twd,
      tws:
        state.tws === undefined ? get().states[boatProfileId]?.tws : state.tws,
    };

    set(s => ({
      states: {
        ...s.states,
        [boatProfileId]: correctedState,
      },
    }));
  },
}));

export const usePlanState = () => {
  const { boatProfile } = useBoatProfile();

  const states = usePlanStore(s => s.states);
  const addState = usePlanStore(s => s.addState);

  const add = (state: Partial<PlanState>) =>
    addState(boatProfile?.id ?? 0, state);

  const currentState = useMemo(() => {
    if (!boatProfile) return null;
    const state = states[boatProfile.id];
    if (!state) return null;
    return state;
  }, [states, boatProfile]);

  return {
    currentState,
    add,
  };
};
