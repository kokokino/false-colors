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

// Game header — round, doom, phase, timer, scoring
// Attrs: game
export const GameHeader = {
  view(vnode) {
    const game = vnode.attrs.game;
    const myPlayer = vnode.attrs.myPlayer;
    if (!game) {
      return null;
    }

    const coins = (game.goldCoins || []).length;
    const skulls = (game.skulls || []).length;

    return m('div.game-header', [
      m('div.game-info-row', [
        m('span.round-display', `Round ${game.currentRound} / ${game.maxRounds}`),
        m('span.phase-display', phaseLabels[game.currentPhase] || game.currentPhase),
        game.phaseDeadline && game.currentPhase !== 'finished'
          ? m(CountdownTimer, { deadline: game.phaseDeadline })
          : null,
        myPlayer
          ? m('span.player-identity', [
              'You are ',
              m('strong', myPlayer.displayName),
              ` the ${myPlayer.role}`,
            ])
          : null,
      ]),
      m(DoomTracker, { doomLevel: game.doomLevel, doomThreshold: game.doomThreshold }),
      m('div.scoring-display', [
        m('span.coins-display', `Gold: ${coins}`),
        m('span.skulls-display', `Skulls: ${skulls}`),
      ]),
      m('div.threat-count', [
        m('span', `Active Threats: ${game.activeThreats.length}`),
      ]),
    ]);
  },
};
