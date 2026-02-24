import m from 'mithril';

// Convert snake_case event types to Title Case for display
export function humanizeEventType(type) {
  if (!type || typeof type !== 'string') {
    return 'Unknown Event';
  }
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const eventLabels = {
  game_started: 'Game started',
  threats_drawn: 'New threats appeared',
  tolls_resolved: 'Tolls resolved',
  actions_resolved: 'Actions resolved',
  accusation_resolved: 'Accusation resolved',
  round_started: 'New round',
  game_ended: 'Game over',
  cook_nourish: 'Cook nourished a crew member',
  player_replaced_by_ai: 'Player replaced by AI',
};

// Scrollable game event log
// Attrs: logs (array)
export const GameLogPanel = {
  oncreate() {
    const container = document.querySelector('.game-log-entries');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    this.prevLogCount = 0;
  },

  onupdate(vnode) {
    const logs = vnode.attrs.logs || [];
    const container = document.querySelector('.game-log-entries');
    if (container && logs.length !== this.prevLogCount) {
      this.prevLogCount = logs.length;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  },

  view(vnode) {
    const logs = vnode.attrs.logs || [];

    return m('details.game-log-panel', { open: false }, [
      m('summary', 'Ship\'s Log'),
      m('div.game-log-entries', logs.map(log =>
        m('div.log-entry', { key: log._id }, [
          m('small.log-round', `R${log.round}`),
          m('span.log-text', eventLabels[log.type] || humanizeEventType(log.type)),
        ])
      )),
    ]);
  },
};
