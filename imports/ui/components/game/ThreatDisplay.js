import m from 'mithril';

// Display active threats with progress bars
// Attrs: threats (array)
export const ThreatDisplay = {
  view(vnode) {
    const threats = vnode.attrs.threats || [];

    if (threats.length === 0) {
      return m('div.threat-display', m('p.muted', 'No active threats.'));
    }

    return m('div.threat-display', [
      m('h3', 'Active Threats'),
      m('div.threat-cards', threats.map(threat =>
        m('article.threat-card', { key: threat.id }, [
          m('header', [
            m('strong', threat.name),
            m('small.threat-type', threat.type),
          ]),
          m('p.threat-desc', threat.description),
          m('div.threat-stats', [
            m('span', `Doom/round: +${threat.doomPerRound}`),
            m('span', `Progress: ${threat.progress} / ${threat.threshold}`),
          ]),
          m('progress', {
            value: threat.progress,
            max: threat.threshold,
          }),
        ])
      )),
    ]);
  },
};
