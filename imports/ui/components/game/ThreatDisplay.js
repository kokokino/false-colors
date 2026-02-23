import m from 'mithril';

const threatTypeNames = {
  fog: 'Fog',
  reef: 'Reef',
  kraken: 'Kraken',
  storm: 'Storm',
  illness: 'Illness',
  hull_breach: 'Hull Breach',
};

const threatSpecialist = {
  fog: 'Navigator',
  reef: 'Navigator',
  kraken: 'Gunner',
  storm: 'Gunner',
  illness: 'Surgeon',
  hull_breach: 'Quartermaster',
};

// Display active threats with progress bars, escalation indicators, and specialist hints
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
        m('article.threat-card', {
          key: threat.id,
          class: threat.escalated ? 'escalated' : '',
        }, [
          m('header', [
            m('strong', threat.name),
            m('small.threat-type', threatTypeNames[threat.type] || threat.type),
            threat.escalated ? m('mark', 'Escalated') : null,
          ]),
          threatSpecialist[threat.type]
            ? m('small.specialist-hint', `${threatSpecialist[threat.type]} specialty`)
            : null,
          m('p.threat-desc', threat.description),
          m('div.threat-stats', [
            m('span', `Doom/round: +${threat.doomPerRound}`),
            m('span', `Progress: ${threat.progress} / ${threat.threshold}`),
            m('span', `Remaining: ${Math.max(0, threat.threshold - threat.progress)}`),
          ]),
          threat.escalated
            ? m('small.warning', 'This threat has grown worse from neglect!')
            : null,
          m('progress', {
            value: threat.progress,
            max: threat.threshold,
          }),
        ])
      )),
    ]);
  },
};
