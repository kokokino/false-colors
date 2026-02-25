import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Toll choice UI — player picks resolve/doom/curse
// Attrs: game, myPlayer
export const TollSelection = {
  oninit() {
    this.submitted = false;
    this.submittedChoice = null;
    this.autoSubmitting = false;
    this.error = null;
  },

  onupdate(vnode) {
    const { game, myPlayer } = vnode.attrs;
    if (myPlayer.phantomRevealed && !this.submitted && !this.autoSubmitting) {
      this.autoSubmitting = true;
      this.submitToll(game._id, 'doom');
    }
  },

  view(vnode) {
    const { game, myPlayer } = vnode.attrs;

    // Revealed phantom: forced to doom
    if (myPlayer.phantomRevealed) {
      return m('div.phase-content.toll-selection', [
        m('h3', 'Pay the Toll'),
        m('p', 'As a revealed phantom, you are forced to add doom.'),
      ]);
    }

    if (this.submitted) {
      const waitingMessages = {
        resolve: 'You sacrificed resolve. Waiting for other crew members...',
        doom: 'You added doom. Waiting for other crew members...',
        curse: 'You drew a curse — it will be revealed when all tolls resolve. Waiting for other crew members...',
      };
      return m('div.phase-content.toll-selection', [
        m('h3', 'Pay the Toll'),
        m('p', waitingMessages[this.submittedChoice] || 'Your toll has been paid. Waiting for other crew members...'),
      ]);
    }

    const hasMadness = myPlayer.curses?.some(c => c.effect === 'tollPenalty') || false;
    const resolveDisabled = myPlayer.resolve <= 0;

    return m('div.phase-content.toll-selection', [
      m('h3', 'Pay the Toll'),
      m('p', 'The cursed waters demand a price from each crew member.'),

      this.error ? m('p.error-message', this.error) : null,

      hasMadness ? m('div.curse-drawn-self', [
        m('strong', 'Sea Madness active'),
        m('br'),
        m('small', 'Your curse adds +1 doom when you choose doom or curse.'),
      ]) : null,

      m('div.toll-options', [
        m('button', {
          onclick: () => this.submitToll(game._id, 'resolve'),
          disabled: resolveDisabled,
        }, [
          m('strong', 'Sacrifice Resolve'),
          m('br'),
          m('small', `Resolve: ${myPlayer.resolve}`),
          m('br'),
          m('small.muted', resolveDisabled
            ? 'Locked — no resolve left.'
            : 'You lose 1 resolve. At 0, your actions lose 1 strength.'),
        ]),

        m('button.secondary', {
          onclick: () => this.submitToll(game._id, 'doom'),
        }, [
          m('strong', hasMadness ? 'Add 2 Doom' : 'Add 1 Doom'),
          m('br'),
          m('small', `Current: ${game.doomLevel} / ${game.doomThreshold}`),
          m('br'),
          m('small.muted', 'Ship doom rises. Default if timer expires.'),
        ]),

        m('button.contrast', {
          onclick: () => this.submitToll(game._id, 'curse'),
        }, [
          m('strong', 'Draw a Curse'),
          m('br'),
          m('small', `Current curses: ${myPlayer.curses?.length || 0}`),
          m('br'),
          m('small.muted', 'Gain a random permanent penalty for this game.'),
        ]),
      ]),

      !(Meteor.user()?.isExpertPlayer) ? m('details.toll-guide', [
        m('summary', 'Toll strategy guide'),
        m('p', [
          m('strong', 'Resolve'), ' is the safest for the ship — it only hurts you. ',
          'But at 0 resolve your actions lose 1 strength, and you can no longer pick this option. The Cook can restore resolve, so coordinate.',
        ]),
        m('p', [
          m('strong', 'Doom'), ' is painless for you but pushes the ship closer to sinking. ',
          'Picking doom too often looks suspicious — the phantom wants doom high.',
        ]),
        m('p', [
          m('strong', 'Curses'), ' are a gamble. The six possibilities: ',
          'Weakened Arm (−1 action strength), Haunted Vision (disables Lookout intel), ',
          'Sea Madness (+1 doom on doom/curse tolls), Phantom Whisper (weaker accusation protection), ',
          'Rotting Stores (−1 resolve per round), Spectral Chill (1 message per discussion).',
        ]),
      ]) : null,
    ]);
  },

  async submitToll(gameId, choice) {
    this.error = null;
    try {
      await Meteor.callAsync('game.submitToll', gameId, choice);
      this.submitted = true;
      this.submittedChoice = choice;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },
};
