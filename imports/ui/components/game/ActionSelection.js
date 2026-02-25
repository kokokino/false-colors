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
        let strength = role ? getActionStrength(role, threat.type) : 1;
        // Apply weakened_arm curse penalty
        const hasWeakenedArm = myPlayer.curses?.some(c => c.effect === 'actionPenalty');
        if (hasWeakenedArm) {
          strength = Math.max(strength - 1, 0);
        }
        // Zero resolve penalty
        if (myPlayer.resolve <= 0) {
          strength = Math.max(strength - 1, 0);
        }
        // Revealed phantom cap
        if (myPlayer.phantomRevealed) {
          strength = Math.min(strength, 1);
        }
        return m('button.action-target', {
          key: threat.id,
          onclick: () => this.submitAction(game._id, threat.id),
        }, [
          m('strong', threat.name),
          m('br'),
          m('small', `Progress: ${threat.progress}/${threat.threshold} | Your strength: +${strength}`),
        ]);
      })),

      !(Meteor.user()?.isExpertPlayer) ? m('details.action-guide', [
        m('summary', 'Action strategy guide'),
        m('p', [
          'Your action adds strength toward resolving a threat. Each threat has a threshold — ',
          'once total crew strength meets it, the threat is defeated. ',
          'Unresolved threats add doom every round and escalate after 2 rounds.',
        ]),
        m('p', [
          m('strong', 'Specialty: '),
          'Specialists contribute +3 strength against their threat types, vs +1 or +2 off-specialty. ',
          'Check the threat\'s specialist hint to coordinate — send the right person to the right threat.',
        ]),
        m('p', [
          m('strong', 'Coordination: '),
          'Actions are simultaneous and secret. If everyone piles onto one threat, others go unresolved ',
          'and keep adding doom. Spread out based on discussion.',
        ]),
        m('p', [
          m('strong', 'Phantom tells: '),
          'The phantom may waste strength on already-resolved threats or stack onto an over-targeted threat. ',
          'Watch for players who consistently avoid contributing where it matters.',
        ]),
      ]) : null,
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
