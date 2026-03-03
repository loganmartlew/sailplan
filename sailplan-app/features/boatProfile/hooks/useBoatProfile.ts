import { use } from 'react';
import { BoatProfileContext } from '../context/BoatProfileContext';

export function useBoatProfile() {
  const context = use(BoatProfileContext);
  if (!context) {
    throw new Error('useBoatProfile must be used within a BoatProfileProvider');
  }
  return context;
}
