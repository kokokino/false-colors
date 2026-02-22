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
  QUARTERMASTER: {
    id: 'quartermaster',
    name: 'Quartermaster',
    specialty: [],
    specialtyStrength: 2,
    offStrength: 2,
    description: 'Jack of all trades — strength 2 against anything.',
  },
  LOOKOUT: {
    id: 'lookout',
    name: 'Lookout',
    specialty: [],
    specialtyStrength: 2,
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
    passive: 'heals 1 supply to all players',
    description: 'Weak fighter but heals 1 supply to all crew each round.',
  },
};

export const RoleList = Object.values(Roles);

// Get action strength for a role against a threat type
export function getActionStrength(role, threatType) {
  if (role.specialty.length > 0 && role.specialty.includes(threatType)) {
    return role.specialtyStrength;
  }
  return role.offStrength;
}
