import m from 'mithril';

// Simultaneous action reveal display — now includes strength per player
// Attrs: revealedActions (array), threats (array)
export const ActionReveal = {
  view(vnode) {
    const actions = vnode.attrs.revealedActions || [];
    const threats = vnode.attrs.threats || [];

    if (actions.length === 0) {
      return m('div.phase-content.action-reveal', [
        m('h3', 'Action Reveal'),
        m('p', 'Waiting for actions to be revealed...'),
      ]);
    }

    // Group actions by threat
    const byThreat = {};
    for (const action of actions) {
      if (!byThreat[action.threatId]) {
        byThreat[action.threatId] = [];
      }
      byThreat[action.threatId].push(action);
    }

    return m('div.phase-content.action-reveal', [
      m('h3', 'Actions Revealed'),
      Object.entries(byThreat).map(([threatId, threatActions]) => {
        const threat = threats.find(t => t.id === threatId);
        const totalStrength = threatActions.reduce((sum, a) => sum + (a.strength || 0), 0);
        return m('div.reveal-group', { key: threatId }, [
          m('h4', [
            threat ? threat.name : 'Unknown Threat',
            m('small', ` (+${totalStrength} total strength)`),
          ]),
          m('ul', threatActions.map(a =>
            m('li', { key: a.seatIndex }, `${a.displayName} (${a.role}) — +${a.strength || 0} strength`)
          )),
        ]);
      }),
    ]);
  },
};
