import m from 'mithril';

// Round end summary display
// Attrs: game
export const RoundEndSummary = {
  view(vnode) {
    const game = vnode.attrs.game;

    return m('div.phase-content.round-end-summary', [
      m('h3', `Round ${game.currentRound} Complete`),
      m('div.summary-stats', [
        m('p', `Doom: ${game.doomLevel} / ${game.doomThreshold}`),
        m('p', `Active threats: ${game.activeThreats.length}`),
        m('p', `Rounds remaining: ${game.maxRounds - game.currentRound}`),
      ]),
      m('p.muted', 'Next round starting shortly...'),
    ]);
  },
};
