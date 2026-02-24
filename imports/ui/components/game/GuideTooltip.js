import m from 'mithril';

const phaseGuides = {
  threat: 'A new danger approaches your ship. Each active threat adds doom every round. If doom hits 15, the ship sinks.',
  toll: 'The cursed waters demand a price. Sacrifice your resolve, accept doom for the ship, or risk a curse. There is no good option.',
  discussion: 'Talk with your crew. Who should target which threat? Check the Voyage Journal — anyone acting suspicious?',
  action: 'Choose a threat to apply your strength to. Your role has a specialty — use it wisely. Your strength is shown for each threat.',
  accusation: 'Suspect someone is the phantom? Accuse them \u2014 but the crew must vote to convict. If acquitted, no penalty. If convicted wrongly, +3 doom and a skull.',
  round_end: 'The Cook may nourish one crew member, restoring their resolve. Watch who they choose.',
};

// Contextual guide tooltip shown for non-expert players
// Attrs: phase (string), expertMode (boolean)
export const GuideTooltip = {
  view(vnode) {
    const { phase, expertMode } = vnode.attrs;

    if (expertMode) {
      return null;
    }

    const guide = phaseGuides[phase];
    if (!guide) {
      return null;
    }

    return m('div.guide-tooltip', [
      m('small', guide),
    ]);
  },
};
