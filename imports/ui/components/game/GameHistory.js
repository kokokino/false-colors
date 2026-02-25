import m from 'mithril';

// Persistent Game History Panel (Voyage Journal)
// Accumulates round-by-round data: tolls, actions, threats, scoring, accusations, Cook nourish
// Attrs: logs (array), game
export const GameHistory = {
  oninit() {
    this.isOpen = false;
  },

  view(vnode) {
    const logs = vnode.attrs.logs || [];
    const game = vnode.attrs.game;

    if (!game) {
      return null;
    }

    // Group logs by round
    const roundMap = {};
    for (const log of logs) {
      if (!roundMap[log.round]) {
        roundMap[log.round] = [];
      }
      roundMap[log.round].push(log);
    }

    const rounds = Object.keys(roundMap).sort((a, b) => Number(b) - Number(a));

    return m('details.game-history', { open: this.isOpen }, [
      m('summary', {
        onclick: (e) => {
          e.preventDefault();
          this.isOpen = !this.isOpen;
        },
      }, 'Voyage Journal'),
      m('div.history-entries', rounds.map(round =>
        m('div.history-round', { key: round }, [
          m('h4', `Round ${round}`),
          m('ul', roundMap[round].map(log =>
            m('li.history-entry', { key: log._id }, formatLogEntry(log))
          )),
        ])
      )),

      // Scoring summary
      m('div.history-scoring', [
        m('h4', 'Score'),
        m('div', [
          m('span', `Gold Coins: ${(game.goldCoins || []).length}`),
          m('span', ` | Skulls: ${(game.skulls || []).length}`),
        ]),
      ]),
    ]);
  },
};

function formatLogEntry(log) {
  const type = log.type;
  const data = log.data || {};

  switch (type) {
    case 'threats_drawn':
      return `Threats: ${(data.newThreats || []).join(', ')} (+${data.doomAdded || 0} doom)`;
    case 'tolls_resolved':
      if (data.resolveCount !== undefined) {
        let tollText = `Tolls: ${data.resolveCount} resolve, ${data.doomCount} doom, ${data.curseCount} curse`;
        if (data.curseDetails && data.curseDetails.length > 0) {
          const curseNames = data.curseDetails.map(cd => cd.curseName).join(', ');
          tollText += ` (${curseNames})`;
        }
        return tollText;
      }
      return `Tolls resolved (${data.submissions || 0} submissions)`;
    case 'actions_resolved':
      if (data.actions && data.actions.length > 0) {
        return data.actions.map(a => `${a.displayName} (${a.role}) → ${a.threatName || '?'} (+${a.strength || '?'})`).join(', ');
      }
      return 'Actions resolved';
    case 'accusation_resolved':
      if (data.correct) {
        return 'Phantom correctly identified!';
      }
      if (data.convicted) {
        return 'Wrong accusation — penalty applied';
      }
      return 'Accusation — crew voted to acquit';
    case 'cook_nourish':
      return `Cook nourished ${data.targetName || 'a crew member'}`;
    case 'round_started':
      return `Round ${data.round} began`;
    case 'game_started':
      return `Game started with ${data.playerCount} players (${data.humanCount} human)`;
    case 'game_ended':
      return `Game ended: ${data.reason}`;
    case 'player_replaced_by_ai':
      return `${data.displayName} disconnected (replaced by AI)`;
    default:
      return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
