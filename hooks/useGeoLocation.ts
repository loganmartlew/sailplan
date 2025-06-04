import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export function useGeoLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    async function getCurrentLocation() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getLastKnownPositionAsync({});
      setLocation(location);
      setLoading(false);
    }

    getCurrentLocation();
  }, []);

  return {
    location,
    error: errorMsg,
    loading,
  };
}
