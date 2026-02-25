// Character card content for Phantom Tides theme
// Keyed by role id from imports/game/roles.js

import { CrewRoster } from './ai/crewRoster.js';

export const CharacterCards = {
  navigator: {
    motto: '"The sea has a path for those who listen."',
    bio: 'Once a cartographer for the Royal Fleet, {surname} lost everything when her charts led a convoy into the Phantom Straits. Now bound to this ghost ship, she reads the tides and fog like scripture, determined to guide this crew where she once failed.',
    abilityName: 'Chart Reader',
    abilityDescription: 'Specializes in navigating fog banks and treacherous reefs. Contributes exceptional effort against these threats but struggles with dangers outside her expertise.',
    specialtyLabel: 'Fog & Reef',
    strengthDisplay: '3 vs specialty / 1 vs other',
    passiveDescription: null,
    strategyTips: [
      'Prioritize fog and reef threats — your strength of 3 makes you the best crew member to handle them.',
      'Coordinate with the Gunner and Surgeon so each specialist tackles their matching threats.',
      'If no fog or reef threats are active, contribute your 1 strength where doom is rising fastest.',
    ],
    phantomTips: [
      'Waste your specialty by targeting threats you are weakest against — contribute 1 instead of 3.',
      'In early rounds, cooperate on fog/reef threats to build trust before pivoting.',
      'Argue that off-specialty threats are more urgent to lure other specialists away from their strengths.',
      'Choose doom tolls when suspicion is low — your strong role makes you less likely to be suspected.',
    ],
  },

  gunner: {
    motto: '"If it bleeds ink or lightning, I can kill it."',
    bio: 'A disgraced naval officer who once sank an allied frigate in a storm of confusion. {surname} was hanged for mutiny, yet woke aboard this cursed vessel with cannons that never jam and thunder in his blood. He fights because fighting is all he has left.',
    abilityName: 'Broadside',
    abilityDescription: 'Specializes in repelling kraken attacks and weathering violent storms. Devastating against maritime monsters but less effective against subtler threats.',
    specialtyLabel: 'Kraken & Storm',
    strengthDisplay: '3 vs specialty / 1 vs other',
    passiveDescription: null,
    strategyTips: [
      'Focus on kraken and storm threats where your strength of 3 is critical.',
      'Let the Navigator handle fog/reef — double-covering specialties wastes crew power.',
      'When storms and krakens are absent, pick the threat closest to completion to help finish it off.',
    ],
    phantomTips: [
      'Target fog or illness threats where you only contribute 1, letting kraken threats fester.',
      'Occasionally handle a kraken threat to maintain cover — total sabotage is too obvious.',
      'Push for doom tolls during discussion, framing it as "saving resolve for the big fights."',
      'Accuse a loyal crew member mid-game to earn a skull and waste a round of actions.',
    ],
  },

  surgeon: {
    motto: '"I have stitched the living and the dead. The difference is smaller than you think."',
    bio: 'Dr. {surname} served aboard plague ships during the Gray Fever outbreak, losing patients and her own sanity in equal measure. She joined this ghost crew willingly, believing cursed waters hold the cure she never found. Her steady hands are the only thing keeping the crew alive.',
    abilityName: 'Plague Ward',
    abilityDescription: 'The sole specialist against illness outbreaks. When plague sweeps the ship, only the Surgeon can contain it effectively. Modest contribution against other threats.',
    specialtyLabel: 'Illness',
    strengthDisplay: '3 vs specialty / 1 vs other',
    passiveDescription: null,
    strategyTips: [
      'You are the only crew member strong against illness — always prioritize it when active.',
      'When no illness threatens, contribute where you can help finish off a nearly-complete threat.',
      'Coordinate with the Cook — their nourish ability can keep you healthy enough to keep fighting.',
    ],
    phantomTips: [
      'Ignore illness threats and let them rack up doom — no one else can handle them efficiently.',
      'Claim you are "saving strength" for an illness that hasn\'t appeared yet.',
      'Target the same threat as other specialists to waste your action without drawing suspicion.',
      'Use curse tolls to accumulate Weakened Arm — it gives you an excuse for low contributions.',
    ],
  },

  quartermaster: {
    motto: '"Every plank, every nail, every soul — all accounted for."',
    bio: '{surname} ran the supply lines for a merchant fleet until a hull breach sank his flagship and his fortune. Meticulous and resourceful, he patches what others overlook. On this ghost ship, his ledgers track not cargo but the dwindling hope of the crew.',
    abilityName: 'Hull Specialist',
    abilityDescription: 'Expert at sealing hull breaches, and a reliable generalist against all other threats. The crew\'s most versatile fighter — never great, but never useless.',
    specialtyLabel: 'Hull Breach',
    strengthDisplay: '3 vs specialty / 2 vs other',
    passiveDescription: null,
    strategyTips: [
      'Handle hull breaches yourself — you hit them for 3, the best anyone can do.',
      'Your off-specialty strength of 2 makes you the ideal backup on any threat. Fill gaps wherever needed.',
      'When multiple non-specialty threats compete for attention, pick the one with the highest doom-per-round.',
    ],
    phantomTips: [
      'Your generalist stats make sabotage harder to detect — use that to target low-priority threats.',
      'Let hull breaches go unaddressed by claiming you are "helping elsewhere" since your off-strength is decent.',
      'Your 2 off-specialty strength means even sabotage contributions look respectable — exploit this cover.',
      'Push for curse tolls to weaken the crew without raising doom visibly.',
    ],
  },

  lookout: {
    motto: '"I see everything. I trust nothing."',
    bio: '{surname} was a lighthouse keeper who watched three ships wreck on her shore in a single night — and swears she saw a phantom crew walking the waves. She joined this voyage to prove she wasn\'t mad. Her eyes never rest, and her suspicion never sleeps.',
    abilityName: 'Vigilance',
    abilityDescription: 'A balanced fighter with no specialty, contributing steady effort against all threats equally. What the Lookout lacks in raw power, they make up for with intelligence.',
    specialtyLabel: 'None (generalist)',
    strengthDisplay: '2 vs all threats',
    passiveDescription: 'Crow\'s Nest: During the action reveal, you see one randomly chosen crew member\'s action assignment before everyone else.',
    strategyTips: [
      'Use your passive intel to spot suspicious behavior — if someone wastes their action, remember it.',
      'With 2 strength across the board, help wherever the biggest gap is. You are the crew\'s flex player.',
      'Share what you learn from your early reveal during discussion — but be careful not to tip off the phantom.',
    ],
    phantomTips: [
      'Your passive reveal works against you — the crew trusts your intel, so use it to misdirect.',
      'Falsely report what you saw in the early reveal to cast suspicion on loyal crew members.',
      'Target whatever threat other specialists are already covering — your 2 strength looks helpful but wastes a slot.',
      'Accuse aggressively to create chaos — even failed accusations cost the crew doom and a skull.',
    ],
  },

  cook: {
    motto: '"A full belly keeps the nightmares at bay... mostly."',
    bio: '{surname} was a tavern owner who fed sailors their last meals before cursed voyages. When his own tavern burned, he found himself aboard this ship with nothing but a ladle and a stubborn refusal to let anyone go hungry. His cooking may be humble, but his care keeps the crew standing.',
    abilityName: 'Galley Hand',
    abilityDescription: 'A capable fighter contributing steady effort against all threats. Combined with nourish, the Cook keeps the crew standing through the worst the sea throws at them.',
    specialtyLabel: 'None',
    strengthDisplay: '2 vs all threats',
    passiveDescription: 'Nourish: Once per round, restore 1 resolve to any crew member (7 meals per game). Use this during the action phase.',
    strategyTips: [
      'With strength 2, you match the Lookout in combat — help wherever the biggest gap is.',
      'Prioritize using Nourish on crew members at 0 resolve to prevent their penalty.',
      'Save some meals for late-game rounds when resolve is scarce and every point matters.',
    ],
    phantomTips: [
      'Nourish yourself or already-healthy crew to waste meals without drawing suspicion.',
      'Your low combat strength means sabotage through action targeting is less impactful — focus on toll sabotage instead.',
      'Withhold nourish from struggling crew members and claim you are "saving meals for emergencies."',
      'Your role is seen as supportive and harmless — use that perception to avoid suspicion longer.',
    ],
  },
};

// Sync titles and bios from crew roster (single source of truth for character names)
for (const crew of CrewRoster) {
  if (CharacterCards[crew.roleId]) {
    CharacterCards[crew.roleId].title = crew.characterName;
    CharacterCards[crew.roleId].bio = CharacterCards[crew.roleId].bio.replace('{surname}', crew.characterName);
  }
}
