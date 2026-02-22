// Dialogue templates for Phantom Tides theme
// Organized by trigger and style. Slot-filling with {threat_name}, {player_name}, etc.

const templates = {
  greeting: {
    terse: [
      'Let\'s get to work.',
      'Stay sharp, crew.',
      'Another round. Eyes open.',
    ],
    worried: [
      'Does anyone else feel like something\'s wrong?',
      'I\'ve got a bad feeling about this round...',
      'We need to be careful. Very careful.',
    ],
    cheerful: [
      'Alright crew, let\'s show these waters who\'s boss!',
      'Another day, another adventure! Who\'s with me?',
      'Keep your spirits up — we\'ve got this!',
    ],
    analytical: [
      'Let\'s assess our situation before acting.',
      'Based on the current threats, we should prioritize carefully.',
      'The numbers don\'t lie. Let\'s review what we know.',
    ],
    bold: [
      'Bring it on! I\'m ready for anything.',
      'No threat\'s too big for this crew!',
      'Who\'s afraid of a little danger? Not me.',
    ],
    solemn: [
      'May the tides show us mercy.',
      'I sense dark waters ahead.',
      'We must hold together, or all is lost.',
    ],
  },

  threatAssessment: {
    terse: [
      '{threat_name}. Dangerous.',
      'Focus on {threat_name}. It\'s the priority.',
      '{threat_name} will sink us if we ignore it.',
    ],
    worried: [
      '{threat_name} terrifies me. We need everyone on this!',
      'Has anyone seen {threat_name} before? It looks deadly...',
      'Oh no, not {threat_name}. We\'re in trouble.',
    ],
    cheerful: [
      '{threat_name}? We\'ve handled worse! Let\'s do this.',
      'Don\'t worry about {threat_name}, crew. We\'ve got the right people for it.',
      '{threat_name} is tough, but so are we!',
    ],
    analytical: [
      '{threat_name} requires {threshold} strength to resolve. We should assign specialists.',
      'The {threat_name} adds {doom_per_round} doom per round. High priority.',
      'Considering our roles, {threat_name} should be our primary target.',
    ],
    bold: [
      'I\'ll take on {threat_name} myself if I have to!',
      '{threat_name}? Ha! Let me at it.',
      'Who wants to help me crush {threat_name}?',
    ],
    solemn: [
      '{threat_name} is an omen. We must act swiftly.',
      'The sea sends {threat_name} to test us.',
      'Pray we have the strength for {threat_name}.',
    ],
  },

  tollReaction: {
    terse: [
      'Paid my toll. Move on.',
      'Done. Let\'s focus.',
      'Toll\'s paid.',
    ],
    worried: [
      'I hated making that choice. There are no good options.',
      'Every toll weakens us more. This can\'t go on.',
      'I don\'t know how much more we can take...',
    ],
    cheerful: [
      'A small price to pay for the crew!',
      'That stung, but we\'ll manage.',
      'Nothing we can\'t bounce back from!',
    ],
    analytical: [
      'I chose the option with the least long-term cost.',
      'Mathematically, that was the optimal toll choice.',
      'The toll impact should be manageable given our resources.',
    ],
    bold: [
      'Ha! That barely hurt.',
      'Bring on the tolls. I can take it.',
      'Is that all you\'ve got?',
    ],
    solemn: [
      'The sea demands its price.',
      'We pay in blood or doom. Neither is kind.',
      'Such is the cost of cursed waters.',
    ],
  },

  accusation: {
    terse: [
      'I\'ve been watching {player_name}. Something\'s off.',
      '{player_name} isn\'t acting right.',
      'Time to call it. {player_name}, explain yourself.',
    ],
    worried: [
      'I\'m sorry, but I think {player_name} might be the phantom...',
      'I don\'t want to accuse anyone, but {player_name}\'s choices have been suspicious.',
      'Please don\'t be angry, but {player_name}, your actions don\'t add up.',
    ],
    cheerful: [
      'Hey {player_name}, buddy, your moves have been a little... questionable.',
      'No hard feelings, but {player_name}, care to explain your choices?',
      'Alright {player_name}, time for some honesty!',
    ],
    analytical: [
      'The evidence points to {player_name}. Their action allocation has been suboptimal by 40%.',
      '{player_name}\'s toll and action pattern is statistically inconsistent with loyalty.',
      'Based on observed behavior, {player_name} has the highest probability of being the phantom.',
    ],
    bold: [
      '{player_name}, I\'m calling you out! You\'re the phantom!',
      'Enough hiding! {player_name} is sabotaging us!',
      'I\'ve seen enough. {player_name}, you\'re done.',
    ],
    solemn: [
      'The spirits whisper of betrayal. {player_name}, is it you?',
      'I sense darkness in your actions, {player_name}.',
      '{player_name}, the sea reveals all truths eventually.',
    ],
  },

  defense: {
    terse: [
      'Wrong. Check the results.',
      'I\'m not the phantom. Look at my contributions.',
      'Accuse me? Fine. You\'re wasting time.',
    ],
    worried: [
      'Please, it\'s not me! I\'ve been doing my best!',
      'You\'ve got the wrong person! I swear I\'m loyal!',
      'No no no, I would never betray the crew!',
    ],
    cheerful: [
      'Me? The phantom? That\'s a good joke!',
      'Come on, you know I\'ve been pulling my weight!',
      'Ha! Check my track record — I\'m the most helpful one here!',
    ],
    analytical: [
      'My action record clearly shows loyalty. Review the data.',
      'If I were the phantom, why would I have targeted the highest-priority threats?',
      'The accusation doesn\'t hold up to scrutiny. Examine my toll choices.',
    ],
    bold: [
      'You want to accuse me? Big mistake.',
      'I\'ve been fighting harder than anyone! Accuse the real threat.',
      'Wrong target. You\'re going to regret wasting this on me.',
    ],
    solemn: [
      'The sea knows my heart is true.',
      'I walk in the light. Accuse me and doom follows.',
      'Search my soul if you must. You will find only loyalty.',
    ],
  },

  commentary: {
    terse: [
      'Doom\'s rising. Pick up the pace.',
      'We need better coordination.',
      'Focus on what matters.',
    ],
    worried: [
      'The doom tracker is getting too high!',
      'Is anyone else worried we won\'t make it?',
      'We need to do better next round or we\'re done for.',
    ],
    cheerful: [
      'We\'re doing great! Keep it up!',
      'That round wasn\'t bad at all!',
      'Teamwork makes the dream work, crew!',
    ],
    analytical: [
      'We need to reduce active threats before doom overwhelms us.',
      'Current doom trajectory gives us {rounds_left} rounds at this rate.',
      'We should focus specialists on their matching threats.',
    ],
    bold: [
      'Let\'s hit these threats harder next round!',
      'We\'re barely scratching the surface. Time to fight!',
      'I say we go all out. No holding back.',
    ],
    solemn: [
      'The cursed waters test our resolve.',
      'We endure. That is all we can do.',
      'The ship holds, but for how long?',
    ],
  },
};

// Get a random template for a given trigger and style
export function getTemplate(trigger, style) {
  const triggerTemplates = templates[trigger];
  if (!triggerTemplates) {
    return 'Hmm...';
  }

  const styleTemplates = triggerTemplates[style];
  if (!styleTemplates || styleTemplates.length === 0) {
    // Fallback to terse
    const fallback = triggerTemplates.terse;
    return fallback ? fallback[Math.floor(Math.random() * fallback.length)] : 'Hmm...';
  }

  return styleTemplates[Math.floor(Math.random() * styleTemplates.length)];
}

// Fill template slots with game data
export function fillSlots(template, slotData) {
  let filled = template;
  for (const [key, value] of Object.entries(slotData)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return filled;
}
