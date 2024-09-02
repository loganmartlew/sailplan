import { useContext } from 'react';
import { BoatProfileContext } from '../context/BoatProfileContext';

export function useBoatProfile() {
  const context = useContext(BoatProfileContext);
  if (!context) {
    throw new Error('useBoatProfile must be used within a BoatProfileProvider');
  }
  return context;
}
