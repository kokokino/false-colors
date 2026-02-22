import m from 'mithril';
import { DoomTracker } from './DoomTracker.js';
import { CountdownTimer } from './CountdownTimer.js';

const phaseLabels = {
  threat: 'New Threat',
  toll: 'Pay the Toll',
  discussion: 'Discussion',
  action: 'Assign Actions',
  accusation: 'Accusations',
  round_end: 'Round Summary',
  finished: 'Game Over',
};

// Game header — round, doom, phase, timer
// Attrs: game
export const GameHeader = {
  view(vnode) {
    const game = vnode.attrs.game;
    if (!game) {
      return null;
    }

    return m('div.game-header', [
      m('div.game-info-row', [
        m('span.round-display', `Round ${game.currentRound} / ${game.maxRounds}`),
        m('span.phase-display', phaseLabels[game.currentPhase] || game.currentPhase),
        game.phaseDeadline && game.currentPhase !== 'finished'
          ? m(CountdownTimer, { deadline: game.phaseDeadline })
          : null,
      ]),
      m(DoomTracker, { doomLevel: game.doomLevel, doomThreshold: game.doomThreshold }),
    ]);
  },
};
