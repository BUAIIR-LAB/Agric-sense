import type { FarmerProfile } from '@/context/AppContext';

/**
 * True when the account was created with thin website signup (or similar)
 * and still needs farm details on mobile.
 */
export function isProfileIncomplete(
  profile?: Pick<FarmerProfile, 'area' | 'cropsGrown' | 'profileComplete'> | null,
): boolean {
  if (!profile) return false;
  if (profile.profileComplete === false) return true;
  if (profile.profileComplete === true) return false;
  const area = (profile.area || '').trim().toLowerCase();
  const crops = profile.cropsGrown || [];
  return (area === '' || area === 'uganda') && crops.length === 0;
}
