// Role definitions for Phantom Tides
// Each role has a specialty threat type where they contribute strength 3

export const Roles = {
  NAVIGATOR: {
    id: 'navigator',
    name: 'Navigator',
    specialty: ['fog', 'reef'],
    specialtyStrength: 3,
    offStrength: 1,
    description: 'Expert at navigating fog and reefs.',
  },
  GUNNER: {
    id: 'gunner',
    name: 'Gunner',
    specialty: ['kraken', 'storm'],
    specialtyStrength: 3,
    offStrength: 1,
    description: 'Expert at fighting krakens and weathering storms.',
  },
  SURGEON: {
    id: 'surgeon',
    name: 'Surgeon',
    specialty: ['illness'],
    specialtyStrength: 3,
    offStrength: 1,
    description: 'Expert at treating illness outbreaks.',
  },
  // Deviation from original "strength 2 generalist" spec: hull_breach specialty
  // gives QM a clear identity while offStrength 2 preserves generalist flexibility.
  QUARTERMASTER: {
    id: 'quartermaster',
    name: 'Quartermaster',
    specialty: ['hull_breach'],
    specialtyStrength: 3,
    offStrength: 2,
    description: 'Expert at hull repairs, solid against any threat.',
  },
  LOOKOUT: {
    id: 'lookout',
    name: 'Lookout',
    specialty: [],
    specialtyStrength: 2, // Intentionally unused — Lookout has no specialty, always uses offStrength
    offStrength: 2,
    passive: 'reveals one other action early during reveal phase',
    description: 'Spots danger early — reveals one action before others.',
  },
  COOK: {
    id: 'cook',
    name: 'Cook',
    specialty: [],
    specialtyStrength: 1,
    offStrength: 1,
    passive: 'nourish: restore 1 resolve to a crew member (5 meals per game)',
    description: 'Weak fighter but can nourish crew to restore resolve.',
  },
};

// Get action strength for a role against a threat type
export function getActionStrength(role, threatType) {
  if (role.specialty.length > 0 && role.specialty.includes(threatType)) {
    return role.specialtyStrength;
  }
  return role.offStrength;
}
