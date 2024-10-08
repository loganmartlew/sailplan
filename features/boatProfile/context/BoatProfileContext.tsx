import { createContext, PropsWithChildren, useEffect, useState } from 'react';
import { useMMKVNumber } from 'react-native-mmkv';
import { getBoatProfile } from '../api/getBoatProfiles';
import { ActivityIndicator, View } from 'react-native';
import { BoatProfile } from '../model/boatProfile';

export interface BoatProfileContextType {
  boatProfile: BoatProfile | null;
  setBoatProfile: (boatProfile: BoatProfile | null) => void;
}

export const BoatProfileContext = createContext<BoatProfileContextType | null>(
  null
);

export function BoatProfileProvider({ children }: PropsWithChildren) {
  const [boatProfile, setBoatProfile] = useState<BoatProfile | null>(null);
  const [kvBoatProfileID, setKVBoatProfileID] = useMMKVNumber('boatProfileID');

  const [isLoading, setIsLoading] = useState(false);

  function updateBoatProfile(boatProfile: BoatProfile | null) {
    setBoatProfile(boatProfile);
    setKVBoatProfileID(boatProfile?.id ?? undefined);
  }

  useEffect(() => {
    if (!kvBoatProfileID || !!boatProfile) return;
    setIsLoading(true);

    getBoatProfile(kvBoatProfileID).then(profile => {
      setBoatProfile(profile);
      setIsLoading(false);
    });
  }, []);

  const context: BoatProfileContextType = {
    boatProfile: boatProfile,
    setBoatProfile: updateBoatProfile,
  };

  if (isLoading) {
    return (
      <View className='flex items-center justify-center h-full'>
        <ActivityIndicator size='large' />
      </View>
    );
  }

  return (
    <BoatProfileContext.Provider value={context}>
      {children}
    </BoatProfileContext.Provider>
  );
}
