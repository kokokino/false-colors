import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Toll choice UI — player picks resolve/doom/curse
// Attrs: game, myPlayer
export const TollSelection = {
  oninit() {
    this.submitted = false;
    this.error = null;
  },

  view(vnode) {
    const { game, myPlayer } = vnode.attrs;

    // Revealed phantom: forced to doom
    if (myPlayer.phantomRevealed) {
      if (!this.submitted) {
        this.submitToll(game._id, 'doom');
      }
      return m('div.phase-content.toll-selection', [
        m('h3', 'Pay the Toll'),
        m('p', 'As a revealed phantom, you are forced to add doom.'),
      ]);
    }

    if (this.submitted) {
      return m('div.phase-content.toll-selection', [
        m('h3', 'Pay the Toll'),
        m('p', 'Your toll has been paid. Waiting for other crew members...'),
      ]);
    }

    return m('div.phase-content.toll-selection', [
      m('h3', 'Pay the Toll'),
      m('p', 'The cursed waters demand a price from each crew member.'),

      this.error ? m('p.error-message', this.error) : null,

      m('div.toll-options', [
        m('button', {
          onclick: () => this.submitToll(game._id, 'resolve'),
          disabled: myPlayer.resolve <= 0,
        }, [
          m('strong', 'Sacrifice Resolve'),
          m('br'),
          m('small', `Resolve: ${myPlayer.resolve}`),
        ]),

        m('button.secondary', {
          onclick: () => this.submitToll(game._id, 'doom'),
        }, [
          m('strong', 'Add 1 Doom'),
          m('br'),
          m('small', `Current: ${game.doomLevel} / ${game.doomThreshold}`),
        ]),

        m('button.contrast', {
          onclick: () => this.submitToll(game._id, 'curse'),
        }, [
          m('strong', 'Draw a Curse'),
          m('br'),
          m('small', `Current curses: ${myPlayer.curses?.length || 0}`),
        ]),
      ]),
    ]);
  },

  async submitToll(gameId, choice) {
    this.error = null;
    try {
      await Meteor.callAsync('game.submitToll', gameId, choice);
      this.submitted = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },
};
