// Phantom Tides crew roster — pre-defined characters assigned to all seats
// Every player (human and AI) gets a character from this roster
// Only the character name is shown in-game, never the player's real username

export const CrewRoster = [
  {
    seatIndex: 0,
    characterName: 'Quartermaster Blackwood',
    roleId: 'quartermaster',
    personality: 'grizzled',
  },
  {
    seatIndex: 1,
    characterName: 'Navigator Voss',
    roleId: 'navigator',
    personality: 'analytical',
  },
  {
    seatIndex: 2,
    characterName: 'Gunner Thorne',
    roleId: 'gunner',
    personality: 'reckless',
  },
  {
    seatIndex: 3,
    characterName: 'Surgeon Crane',
    roleId: 'surgeon',
    personality: 'nervous',
  },
  {
    seatIndex: 4,
    characterName: 'Lookout Maren',
    roleId: 'lookout',
    personality: 'jovial',
  },
  {
    seatIndex: 5,
    characterName: 'Cook Delgado',
    roleId: 'cook',
    personality: 'devout',
  },
];

// Shuffle the roster for random seat assignment
export function shuffleRoster() {
  const shuffled = [...CrewRoster];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Reassign seatIndex after shuffle
  return shuffled.map((entry, index) => ({
    ...entry,
    seatIndex: index,
  }));
}
