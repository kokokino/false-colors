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
      'With doom at {doom_level}, {threat_name} adding {doom_per_round} more is terrifying!',
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

  escalatedThreatObservation: {
    terse: [
      'That threat\'s escalated. Focus.',
      '{escalated_threat_name} is worse now. Prioritize it.',
      'Escalated threat. No more delays.',
    ],
    worried: [
      'It\'s getting worse! We can\'t ignore {escalated_threat_name} any longer!',
      '{escalated_threat_name} has escalated... I\'m really scared now.',
      'That escalation is bad. {escalated_doom_per_round} doom per round!',
    ],
    cheerful: [
      '{escalated_threat_name} escalated, but we can handle it! Let\'s focus up!',
      'Okay, {escalated_threat_name} got tougher. Time to bring our A-game!',
      'Escalated threat? Challenge accepted!',
    ],
    analytical: [
      'The escalated threat {escalated_threat_name} is now adding {escalated_doom_per_round} doom per round. Prioritize it.',
      '{escalated_threat_name} has worsened. At {escalated_doom_per_round} doom/round, it\'s our top priority.',
      'Escalation analysis: {escalated_threat_name} now costs {escalated_doom_per_round} doom. Specialists should target it.',
    ],
    bold: [
      '{escalated_threat_name} thinks it can scare us by escalating? Wrong!',
      'Escalated or not, {escalated_threat_name} is going down!',
      'Bring it on, {escalated_threat_name}! We\'ll smash you harder!',
    ],
    solemn: [
      '{escalated_threat_name} grows in power. The sea shows no mercy.',
      'The escalation of {escalated_threat_name} darkens our path. We must act.',
      'As {escalated_threat_name} worsens, so too must our resolve strengthen.',
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
      'At {doom_level}/{doom_threshold} doom, that was the optimal toll choice.',
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

  tollObservation: {
    terse: [
      '{doom_tolls} doom choices. Not good.',
      'Too many picking doom. Someone explain.',
      '{doom_tolls} went with doom this round. Watch who.',
    ],
    worried: [
      '{doom_tolls} doom choices this round... are we being sabotaged?',
      'So many people picked doom! We can\'t afford this!',
      'Why is everyone choosing doom? This is terrifying.',
    ],
    cheerful: [
      'Rough round on tolls — {doom_tolls} doom picks. We\'ll bounce back!',
      'That\'s a lot of doom choices. Let\'s do better next time, crew!',
      '{doom_tolls} doom? Alright, we\'ve had worse!',
    ],
    analytical: [
      '{doom_tolls} doom, {resolve_tolls} resolve, {curse_tolls} curse. That\'s a concerning ratio.',
      'Statistically, {doom_tolls} doom choices in one round is unusual. Worth noting.',
      'The toll distribution suggests at least one player is avoiding personal cost.',
    ],
    bold: [
      '{doom_tolls} doom picks? Come on, crew, show some backbone!',
      'Who keeps choosing doom? Cowards or saboteurs.',
      'Doom\'s piling up because someone won\'t sacrifice. Step up.',
    ],
    solemn: [
      '{doom_tolls} chose the path of doom. The sea grows hungrier.',
      'So much doom chosen freely. Are we cursed from within?',
      'The toll reveals the soul. {doom_tolls} doom choices trouble me.',
    ],
  },

  actionObservation: {
    terse: [
      'Why did {action_player} target {action_threat}? Off-specialty.',
      '{action_player} wasted their action. Noted.',
      '{action_player} could\'ve done more on {action_specialty}.',
    ],
    worried: [
      'Did anyone notice {action_player} targeted {action_threat}? Their specialty is {action_specialty}...',
      'I\'m worried about {action_player}\'s choices. That wasn\'t optimal.',
      'Why would {action_player} go for {action_threat} when they\'re better elsewhere?',
    ],
    cheerful: [
      'Hey {action_player}, why {action_threat}? Your specialty is elsewhere, friend!',
      '{action_player}, buddy, you could\'ve done more damage on your specialty!',
      'Just an observation — {action_player} didn\'t use their specialty. Maybe next round!',
    ],
    analytical: [
      '{action_player} targeted {action_threat} instead of their specialty type. Suboptimal by significant margin.',
      'Interesting choice by {action_player}. Their role strength is wasted on {action_threat}.',
      'The data shows {action_player} consistently ignoring their specialty advantage.',
    ],
    bold: [
      '{action_player}, what are you doing targeting {action_threat}? Fight where you\'re strong!',
      'Either {action_player} doesn\'t know their role or they\'re not trying.',
      '{action_player}! You had one job — target your specialty!',
    ],
    solemn: [
      'The spirits question {action_player}\'s choice. {action_threat} was not their calling.',
      '{action_player} strays from their purpose. This concerns me.',
      'One wonders why {action_player} turned from their true strength.',
    ],
  },

  cookObservation: {
    terse: [
      '{cook_name} healed {player_name}. Interesting.',
      'Cook chose {player_name}. Others needed it more.',
      'Nourish went to {player_name}. Questionable.',
    ],
    worried: [
      'Why did {cook_name} heal {player_name}? Others were in worse shape!',
      'The Cook\'s choice worries me. {player_name} didn\'t need it most.',
      'Someone at zero resolve was ignored by the Cook...',
    ],
    cheerful: [
      '{cook_name} nourished {player_name}! Good to see the crew looking out for each other.',
      'Nice choice, {cook_name}! Keep those meals coming!',
      'Another meal well spent by {cook_name}!',
    ],
    analytical: [
      '{cook_name} nourished {player_name}. Based on resolve levels, this was suboptimal.',
      'The Cook\'s target selection pattern is worth tracking.',
      'Cook healed {player_name} at higher resolve when lower-resolve targets existed.',
    ],
    bold: [
      '{cook_name}, why {player_name}? Others need it more!',
      'Cook needs to prioritize better. {player_name} was fine.',
      'Meals are limited! Make them count, {cook_name}!',
    ],
    solemn: [
      'The Cook\'s mercy fell upon {player_name}. Was it wisdom or design?',
      '{cook_name} chose carefully. Or perhaps carelessly.',
      'Five meals for the voyage. Each choice reveals the Cook\'s heart.',
    ],
  },

  phantomRevealedReaction: {
    terse: [
      'Knew it. {player_name} was the phantom.',
      'Phantom found. Stay focused.',
      '{player_name} revealed. Keep moving.',
    ],
    worried: [
      'Oh thank goodness! {player_name} was the phantom all along!',
      'I can\'t believe it was {player_name}... at least we know now.',
      'We found the phantom, but can we still survive?',
    ],
    cheerful: [
      'Ha! Got you, {player_name}! The phantom is exposed!',
      'One mystery solved! Now let\'s finish this voyage!',
      'Phantom unmasked! Things are looking up, crew!',
    ],
    analytical: [
      'Phantom confirmed as {player_name}. Their behavioral pattern now makes sense.',
      '{player_name} is the phantom. Doom reduced by 3. Let\'s reassess our position.',
      'The data was right. {player_name}\'s action history was 40% suboptimal.',
    ],
    bold: [
      'I knew {player_name} was rotten! Phantom exposed!',
      '{player_name}! Caught red-handed. Justice is served.',
      'That\'s what you get, {player_name}. The crew sees all.',
    ],
    solemn: [
      'The phantom walks revealed among us. {player_name}, your shadows are lifted.',
      'Truth pierces the veil at last. {player_name} was the betrayer.',
      'The sea strips all masks eventually. {player_name} is the phantom.',
    ],
  },

  scoreObservation: {
    terse: [
      '{coins} coins, {skulls} skulls. Need more coins.',
      'Score: {coins} to {skulls}. We need to resolve threats.',
      'Coin deficit. Focus up.',
    ],
    worried: [
      'We have {coins} coins and {skulls} skulls. We\'re losing!',
      'The skulls are piling up! We need more gold!',
      'At this rate we won\'t have enough coins. What do we do?',
    ],
    cheerful: [
      '{coins} gold coins so far! Let\'s keep racking them up!',
      'We\'ve got {coins} coins and {skulls} skulls — we can still win this!',
      'Every threat we defeat is another coin. Let\'s go!',
    ],
    analytical: [
      'Score is {coins} coins versus {skulls} skulls. We need coins > skulls to win.',
      'At current rate, we\'re projected to end with a coin deficit. Prioritize threat resolution.',
      '{coins}/{skulls} coin-to-skull ratio. Each unresolved escalated threat costs a skull.',
    ],
    bold: [
      '{coins} coins? We can do better! Smash those threats!',
      'Only {skulls} skulls — not bad. Let\'s earn more gold!',
      'Score\'s tight. Time to fight harder.',
    ],
    solemn: [
      '{coins} blessings and {skulls} curses mark our voyage so far.',
      'The scales of fortune weigh {coins} against {skulls}. We must tip them.',
      'Gold and skulls... the sea keeps its tally.',
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

  doomWarning: {
    terse: [
      '{doom_level} doom. {doom_remaining} left. No room for error.',
      'Doom at {doom_level}. We need to tighten up.',
      '{doom_remaining} doom to spare. That\'s it.',
    ],
    worried: [
      'We\'re at {doom_level} out of {doom_threshold} doom! We can\'t afford another point!',
      'Only {doom_remaining} doom left before we\'re done for! What do we do?!',
      'I can barely look at the doom tracker... {doom_level} already!',
    ],
    cheerful: [
      'Okay, doom\'s at {doom_level}... but {doom_remaining} to go! We can still turn this around!',
      'Sure, {doom_level} doom is a lot, but I believe in this crew!',
      '{doom_remaining} doom left — tight, but we\'ve had worse! Right?',
    ],
    analytical: [
      'Doom is at {doom_percent}% capacity. At current rate, we have roughly {rounds_left} rounds.',
      'We\'re at {doom_level}/{doom_threshold}. Every doom point from here is critical.',
      'Analysis: {doom_remaining} doom remaining. Threat mitigation is now top priority.',
    ],
    bold: [
      'Only {doom_remaining} doom to spare? Good. I work best under pressure.',
      'Doom at {doom_level}? Let them bring it. We\'re not done yet.',
      '{doom_percent}% doom? Ha! We\'ve got this.',
    ],
    solemn: [
      'The abyss creeps closer — {doom_level} of {doom_threshold}. We must hold the line.',
      'Doom weighs heavy at {doom_level}. Pray we find strength.',
      'Only {doom_remaining} steps from the edge. The sea tests our faith.',
    ],
  },

  commentary: {
    terse: [
      'Doom\'s rising. Pick up the pace.',
      'We need better coordination.',
      'Focus on what matters.',
      '{doom_remaining} doom left. Every choice counts.',
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
