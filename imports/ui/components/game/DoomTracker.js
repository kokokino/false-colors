import m from 'mithril';

// Doom progress bar — shows current doom vs threshold
// Attrs: doomLevel, doomThreshold
export const DoomTracker = {
  view(vnode) {
    const { doomLevel, doomThreshold } = vnode.attrs;
    const percentage = Math.min((doomLevel / doomThreshold) * 100, 100);
    const danger = percentage > 75 ? 'danger' : percentage > 50 ? 'warning' : '';

    return m('div.doom-tracker', [
      m('div.doom-label', [
        m('span', 'Doom'),
        m('span', `${doomLevel} / ${doomThreshold}`),
      ]),
      m('progress', {
        value: doomLevel,
        max: doomThreshold,
        class: danger,
      }),
    ]);
  },
};
