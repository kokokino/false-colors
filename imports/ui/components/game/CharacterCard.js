import m from 'mithril';
import { CharacterCards } from '../../../game/characterCards.js';

// Character card modal — shows role abilities, bio, and strategy tips
// Attrs: player (object with role, alignment, displayName), isSelf (boolean), onDismiss (callback)
export const CharacterCard = {
  view(vnode) {
    const { player, isSelf, onDismiss } = vnode.attrs;
    if (!player) {
      return null;
    }

    const card = CharacterCards[player.role];
    if (!card) {
      return null;
    }

    const isPhantom = isSelf && player.alignment === 'phantom';
    let dismissText = 'Close';
    if (isSelf) {
      dismissText = isPhantom ? 'Embrace the Darkness' : 'To Your Station';
    }

    return m('dialog.character-card-dialog[open]', [
      m('article', [
        m('header', [
          m('h3', card.title),
          m('p.motto', card.motto),
        ]),

        m('section', [
          m('p', card.bio),
        ]),

        m('section', [
          m('h4', card.abilityName),
          m('p', card.abilityDescription),
          m('div.strength-summary', [
            m('span', ['Specialty: ', m('strong', card.specialtyLabel)]),
            m('span', ['Strength: ', m('strong', card.strengthDisplay)]),
          ]),
        ]),

        card.passiveDescription
          ? m('section', [
              m('h4', 'Passive Ability'),
              m('p', card.passiveDescription),
            ])
          : null,

        m('section', [
          m('h4', isSelf ? 'Strategy Tips' : `Playing as ${card.title}`),
          m('ul', card.strategyTips.map(tip => m('li', { key: tip }, tip))),
        ]),

        isPhantom
          ? [
              m('hr'),
              m('section.phantom-section', [
                m('h4', 'Phantom Strategy'),
                m('p', 'You are the phantom. Sabotage the crew from within without being detected.'),
                m('ul', card.phantomTips.map(tip => m('li', { key: tip }, tip))),
              ]),
            ]
          : null,

        m('footer', [
          m('button', { onclick: onDismiss }, dismissText),
        ]),
      ]),
    ]);
  },
};
