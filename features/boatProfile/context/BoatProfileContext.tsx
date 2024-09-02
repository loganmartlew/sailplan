import { createContext, PropsWithChildren, useState } from 'react';
import { BoatProfile } from '../types/boatProfile';

export interface BoatProfileContextType {
  boatProfile: BoatProfile | null;
  setBoatProfile: (boatProfile: BoatProfile | null) => void;
}

export const BoatProfileContext = createContext<BoatProfileContextType | null>(
  null
);

export function BoatProfileProvider({ children }: PropsWithChildren) {
  const [boatProfile, setBoatProfile] = useState<BoatProfile | null>(null);

  function updateBoatProfile(boatProfile: BoatProfile | null) {
    setBoatProfile(boatProfile);
  }

  const context: BoatProfileContextType = {
    boatProfile: boatProfile,
    setBoatProfile: updateBoatProfile,
  };

  return (
    <BoatProfileContext.Provider value={context}>
      {children}
    </BoatProfileContext.Provider>
  );
}
