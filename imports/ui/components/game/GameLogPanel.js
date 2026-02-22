import m from 'mithril';

const eventLabels = {
  game_started: 'Game started',
  threats_drawn: 'New threats appeared',
  tolls_resolved: 'Tolls resolved',
  actions_resolved: 'Actions resolved',
  accusation_resolved: 'Accusation resolved',
  round_started: 'New round',
  game_ended: 'Game over',
};

// Scrollable game event log
// Attrs: logs (array)
export const GameLogPanel = {
  onupdate() {
    const container = document.querySelector('.game-log-entries');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  view(vnode) {
    const logs = vnode.attrs.logs || [];

    return m('details.game-log-panel', { open: false }, [
      m('summary', 'Ship\'s Log'),
      m('div.game-log-entries', logs.map(log =>
        m('div.log-entry', { key: log._id }, [
          m('small.log-round', `R${log.round}`),
          m('span.log-text', eventLabels[log.type] || log.type),
        ])
      )),
    ]);
  },
};
