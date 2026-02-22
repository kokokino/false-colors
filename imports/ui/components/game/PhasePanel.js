import m from 'mithril';
import { ThreatReveal } from './ThreatReveal.js';
import { TollSelection } from './TollSelection.js';
import { DiscussionChat } from './DiscussionChat.js';
import { ActionSelection } from './ActionSelection.js';
import { ActionReveal } from './ActionReveal.js';
import { AccusationPanel } from './AccusationPanel.js';
import { RoundEndSummary } from './RoundEndSummary.js';

// Phase-based component switcher
// Attrs: game, myPlayer, messages
export const PhasePanel = {
  view(vnode) {
    const { game, myPlayer, messages } = vnode.attrs;
    if (!game || !myPlayer) {
      return null;
    }

    switch (game.currentPhase) {
      case 'threat':
        return m(ThreatReveal, { threats: game.activeThreats });

      case 'toll':
        return m(TollSelection, { game, myPlayer });

      case 'discussion':
        return m(DiscussionChat, { game, myPlayer, messages });

      case 'action':
        // Show reveal if available, otherwise show selection
        if (game.revealedActions) {
          return m(ActionReveal, {
            revealedActions: game.revealedActions,
            threats: game.activeThreats,
          });
        }
        return m(ActionSelection, { game, myPlayer, lookoutReveal: game.lookoutReveal });

      case 'accusation':
        return m(AccusationPanel, { game, myPlayer });

      case 'round_end':
        return m(RoundEndSummary, { game, myPlayer });

      default:
        return m('p', 'Unknown phase');
    }
  },
};
