import m from 'mithril';

// New threat reveal display (shown during THREAT phase)
// Attrs: threats (array of active threats)
export const ThreatReveal = {
  view(vnode) {
    const threats = vnode.attrs.threats || [];
    return m('div.phase-content.threat-reveal', [
      m('h3', 'New Threats Approaching'),
      m('p.muted', 'The cursed waters bring new dangers...'),
      threats.length > 0
        ? m('div.threat-cards', threats.slice(-2).map(t =>
            m('article.threat-card.new-threat', { key: t.id }, [
              m('header', m('strong', t.name)),
              m('p', t.description),
              m('small', `Type: ${t.type} | Doom/round: +${t.doomPerRound} | Strength needed: ${t.threshold}`),
            ])
          ))
        : m('p', 'No new threats this round.'),
    ]);
  },
};
