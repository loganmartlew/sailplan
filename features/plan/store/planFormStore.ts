import { useMemo } from 'react';
import { create } from 'zustand';
import { useBoatProfile } from '~/features/boatProfile';

interface PlanFormState {
  tws: number | null;
  twd: number;
}

interface PlanFormStore {
  states: Record<number, PlanFormState>;
  addState: (boatProfileId: number, state: PlanFormState) => void;
}

const usePlanFormStore = create<PlanFormStore>((set, get) => ({
  states: {},
  addState: (boatProfileId, state) =>
    set(s => ({
      states: {
        ...s.states,
        [boatProfileId]: state,
      },
    })),
}));

export const usePlanFormState = () => {
  const { boatProfile } = useBoatProfile();

  const states = usePlanFormStore(s => s.states);
  const addState = usePlanFormStore(s => s.addState);

  const add = (state: { tws: number | null; twd: number }) =>
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
