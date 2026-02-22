import m from 'mithril';

// Player list — identical display for humans and AI
// Attrs: players (array, already stripped of isAI/alignment), currentSeat (number)
export const PlayerPanel = {
  view(vnode) {
    const players = vnode.attrs.players || [];
    const currentSeat = vnode.attrs.currentSeat;

    return m('div.player-panel', [
      m('h3', 'Crew'),
      m('ul.crew-list', players.map(player =>
        m('li.crew-member', {
          key: player.seatIndex,
          class: player.seatIndex === currentSeat ? 'is-self' : '',
        }, [
          m('div.crew-info', [
            m('strong', player.displayName),
            m('small.role-badge', player.role),
          ]),
          m('div.crew-stats', [
            m('span', `Supplies: ${player.supplies}`),
            player.curses && player.curses.length > 0
              ? m('span.curse-count', `Curses: ${player.curses.length}`)
              : null,
            !player.hasNextAction
              ? m('span.no-action', 'Action lost')
              : null,
          ]),
        ])
      )),
    ]);
  },
};
