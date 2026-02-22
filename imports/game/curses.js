// Curse card effects for Phantom Tides
// Players draw curses as a toll option — each has a persistent negative effect

export const Curses = [
  {
    id: 'weakened_arm',
    name: 'Weakened Arm',
    effect: 'actionPenalty',
    value: -1,
    description: 'Your action strength is reduced by 1 (minimum 0).',
  },
  {
    id: 'haunted_vision',
    name: 'Haunted Vision',
    effect: 'noLookout',
    value: true,
    description: 'You can no longer benefit from the Lookout\'s early reveal.',
  },
  {
    id: 'sea_madness',
    name: 'Sea Madness',
    effect: 'tollPenalty',
    value: 1,
    description: 'Your toll costs 1 additional doom.',
  },
  {
    id: 'phantom_whisper',
    name: 'Phantom Whisper',
    effect: 'accusationPenalty',
    value: true,
    description: 'If you are falsely accused, the accuser loses no action.',
  },
  {
    id: 'rotting_stores',
    name: 'Rotting Stores',
    effect: 'supplyDrain',
    value: 1,
    description: 'You lose 1 supply at the end of each round.',
  },
  {
    id: 'spectral_chill',
    name: 'Spectral Chill',
    effect: 'discussionPenalty',
    value: true,
    description: 'You can only send 1 message per discussion round.',
  },
];

// Draw a random curse from the pool
export function drawCurse() {
  const index = Math.floor(Math.random() * Curses.length);
  return { ...Curses[index] };
}
