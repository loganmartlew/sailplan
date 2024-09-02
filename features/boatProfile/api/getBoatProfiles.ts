import {
  useSuspenseQuery,
  UseSuspenseQueryOptions,
} from '@tanstack/react-query';
import { BoatProfile } from '../types/boatProfile';

const boatProfiles: BoatProfile[] = [
  {
    id: '13725',
    name: 'Boogie Flash',
  },
  {
    id: '73245',
    name: 'Max Headroom',
  },
  {
    id: '87345',
    name: 'Pretty Boy Floyd',
  },
  {
    id: '99267',
    name: 'Marshall Law',
  },
];

export const boatProfilesQueryKey = ['boatProfiles'];

export async function getBoatProfiles() {
  return boatProfiles;
}

export function useBoatProfiles(
  options?: UseSuspenseQueryOptions<
    BoatProfile[],
    Error,
    BoatProfile[],
    string[]
  >
) {
  return useSuspenseQuery({
    ...options,
    queryKey: boatProfilesQueryKey,
    queryFn: getBoatProfiles,
  });
}
