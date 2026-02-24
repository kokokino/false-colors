import m from 'mithril';

// Player list — identical display for humans and AI
// Attrs: players (array, already stripped of isAI), currentSeat (number)
export const PlayerPanel = {
  view(vnode) {
    const players = vnode.attrs.players || [];
    const currentSeat = vnode.attrs.currentSeat;

    return m('div.player-panel', [
      m('h3', 'Crew'),
      m('ul.crew-list', players.map(player =>
        m('li.crew-member', {
          key: player.seatIndex,
          class: [
            player.seatIndex === currentSeat ? 'is-self' : '',
            player.phantomRevealed ? 'phantom-revealed' : '',
          ].filter(Boolean).join(' '),
        }, [
          m('div.crew-info', [
            m('strong', player.displayName),
            m('small.role-badge', player.role),
            player.seatIndex === currentSeat ? m('mark.you-badge', 'YOU') : null,
            player.phantomRevealed ? m('mark', 'PHANTOM') : null,
          ]),
          m('div.crew-stats', [
            m('span', `Resolve: ${player.resolve}`),
            player.curses && player.curses.length > 0
              ? player.curses.map(curse =>
                  m('span.curse-badge', { key: curse.id, title: curse.description }, curse.name)
                )
              : null,
            !player.hasNextAction
              ? m('span.no-action', 'Action lost')
              : null,
            player.hasAccused
              ? m('span.accused', 'Accusation used')
              : null,
            player.mealsRemaining !== undefined
              ? m('span.meals', `Meals: ${player.mealsRemaining}`)
              : null,
          ]),
        ])
      )),
    ]);
  },
};
