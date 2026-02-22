// Threat deck for Phantom Tides
// Each threat has a type, strength threshold, doom-per-round if unresolved, and flavor

export const ThreatType = {
  FOG: 'fog',
  REEF: 'reef',
  KRAKEN: 'kraken',
  STORM: 'storm',
  ILLNESS: 'illness',
  HULL_BREACH: 'hull_breach',
};

const threatDeck = [
  // Fog threats — Navigator specialty
  { type: ThreatType.FOG, name: 'Blinding Fog', threshold: 4, doomPerRound: 1, description: 'Thick fog obscures the ship\'s path.' },
  { type: ThreatType.FOG, name: 'Phantom Mist', threshold: 5, doomPerRound: 1, description: 'An unnatural mist writhes with spectral shapes.' },
  { type: ThreatType.FOG, name: 'Dead Calm Haze', threshold: 6, doomPerRound: 2, description: 'The air goes still and the fog closes in.' },

  // Reef threats — Navigator specialty
  { type: ThreatType.REEF, name: 'Jagged Shallows', threshold: 4, doomPerRound: 1, description: 'Razor-sharp rocks lurk beneath the surface.' },
  { type: ThreatType.REEF, name: 'Bone Reef', threshold: 5, doomPerRound: 1, description: 'A reef of petrified bones scrapes the hull.' },
  { type: ThreatType.REEF, name: 'The Maw', threshold: 7, doomPerRound: 2, description: 'A massive underwater formation that could tear the ship apart.' },

  // Kraken threats — Gunner specialty
  { type: ThreatType.KRAKEN, name: 'Tentacle Sighting', threshold: 4, doomPerRound: 1, description: 'Something massive stirs beneath the waves.' },
  { type: ThreatType.KRAKEN, name: 'Kraken Attack', threshold: 6, doomPerRound: 2, description: 'A great beast wraps its tentacles around the hull.' },
  { type: ThreatType.KRAKEN, name: 'Leviathan Rise', threshold: 8, doomPerRound: 2, description: 'The sea itself seems to rise against the ship.' },

  // Storm threats — Gunner specialty
  { type: ThreatType.STORM, name: 'Squall Line', threshold: 4, doomPerRound: 1, description: 'Dark clouds roll in from the horizon.' },
  { type: ThreatType.STORM, name: 'Cursed Tempest', threshold: 6, doomPerRound: 2, description: 'Lightning strikes with unnatural precision.' },
  { type: ThreatType.STORM, name: 'Maelstrom', threshold: 8, doomPerRound: 2, description: 'The sea opens into a spinning vortex of destruction.' },

  // Illness threats — Surgeon specialty
  { type: ThreatType.ILLNESS, name: 'Fever Sweats', threshold: 3, doomPerRound: 1, description: 'Several crew members collapse with fever.' },
  { type: ThreatType.ILLNESS, name: 'Spectral Plague', threshold: 5, doomPerRound: 1, description: 'An unnatural sickness spreads through the crew.' },
  { type: ThreatType.ILLNESS, name: 'Death Rattle', threshold: 7, doomPerRound: 2, description: 'The crew wastes away as a deadly plague takes hold.' },

  // Hull breach threats — Quartermaster specialty
  { type: ThreatType.HULL_BREACH, name: 'Cracked Planks', threshold: 4, doomPerRound: 1, description: 'Water seeps through weakened planking below the waterline.' },
  { type: ThreatType.HULL_BREACH, name: 'Shattered Hull', threshold: 6, doomPerRound: 2, description: 'A gaping hole lets the cursed sea pour in.' },
  { type: ThreatType.HULL_BREACH, name: 'Keelbreak', threshold: 8, doomPerRound: 2, description: 'The keel itself splinters — the ship is tearing apart.' },
];

// Shuffle an array using Fisher-Yates
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Create a shuffled threat deck for a game
export function createThreatDeck() {
  return shuffle(threatDeck);
}

// Draw 1-2 threats from the deck depending on round
export function drawThreats(deck, round) {
  const count = round >= 6 ? 2 : 1;
  const drawn = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    const threat = deck.shift();
    drawn.push({
      ...threat,
      id: `threat_${Date.now()}_${i}`,
      progress: 0,
      roundAdded: round,
    });
  }
  return { drawn, remaining: deck };
}
