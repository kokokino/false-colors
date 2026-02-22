import m from 'mithril';

// Brief intro modal for non-expert players when game starts
// Attrs: onDismiss (callback), expertMode (boolean)
export const GameIntro = {
  view(vnode) {
    const { onDismiss, expertMode } = vnode.attrs;

    if (expertMode) {
      return null;
    }

    return m('dialog[open]', [
      m('article', [
        m('header', m('h3', 'The Voyage Begins')),
        m('p', 'You are crew aboard a ghost ship sailing cursed waters toward the legendary Sunken Crown.'),
        m('p', 'Each round, threats appear. Work together to defeat them and earn gold coins.'),
        m('p', [
          'But beware — a phantom ',
          m('strong', 'may'),
          ' walk among you, secretly working to doom the ship.',
        ]),
        m('p', 'Survive the voyage. Earn more gold coins than skulls. Trust wisely.'),
        m('footer', [
          m('button', { onclick: onDismiss }, 'Set Sail'),
        ]),
      ]),
    ]);
  },
};
