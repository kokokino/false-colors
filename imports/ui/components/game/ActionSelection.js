import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { Roles, getActionStrength } from '../../../game/roles.js';

// Action assignment UI — player picks which threat to target
// Attrs: game, myPlayer, lookoutReveal (only present for lookout players)
export const ActionSelection = {
  oninit() {
    this.submitted = false;
    this.error = null;
  },

  view(vnode) {
    const { game, myPlayer, lookoutReveal } = vnode.attrs;

    if (!myPlayer.hasNextAction) {
      return m('div.phase-content.action-selection', [
        m('h3', 'Assign Actions'),
        lookoutReveal ? renderLookoutIntel(lookoutReveal, game) : null,
        m('p', 'You have lost your action this round. Waiting for others...'),
      ]);
    }

    if (this.submitted) {
      return m('div.phase-content.action-selection', [
        m('h3', 'Assign Actions'),
        lookoutReveal ? renderLookoutIntel(lookoutReveal, game) : null,
        m('p', 'Action assigned. Waiting for other crew members...'),
      ]);
    }

    return m('div.phase-content.action-selection', [
      m('h3', 'Assign Actions'),
      m('p', `As ${myPlayer.displayName} (${myPlayer.role}), choose a threat to apply your action to.`),

      lookoutReveal ? renderLookoutIntel(lookoutReveal, game) : null,

      this.error ? m('p.error-message', this.error) : null,

      m('div.action-targets', game.activeThreats.map(threat => {
        const role = Object.values(Roles).find(r => r.id === myPlayer.role);
        const strength = role ? getActionStrength(role, threat.type) : 1;
        return m('button.action-target', {
          key: threat.id,
          onclick: () => this.submitAction(game._id, threat.id),
        }, [
          m('strong', threat.name),
          m('br'),
          m('small', `Progress: ${threat.progress}/${threat.threshold} | Your strength: +${strength}`),
        ]);
      })),
    ]);
  },

  async submitAction(gameId, threatId) {
    this.error = null;
    try {
      await Meteor.callAsync('game.submitAction', gameId, threatId);
      this.submitted = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },
};

function renderLookoutIntel(lookoutReveal, game) {
  const threat = game.activeThreats.find(t => t.id === lookoutReveal.threatId);
  const threatName = threat ? threat.name : 'unknown threat';
  return m('div.lookout-intel', [
    m('strong', 'Lookout Intel: '),
    m('span', `${lookoutReveal.displayName} is targeting ${threatName}`),
  ]);
}
