import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Toll choice UI — player picks supply/doom/curse
// Attrs: game, myPlayer
export const TollSelection = {
  oninit() {
    this.submitted = false;
    this.error = null;
  },

  view(vnode) {
    const { game, myPlayer } = vnode.attrs;

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
          onclick: () => this.submitToll(game._id, 'supply'),
          disabled: myPlayer.supplies <= 0 && (game.shipSupplies || 0) <= 0,
        }, [
          m('strong', 'Lose 1 Supply'),
          m('br'),
          m('small', myPlayer.supplies > 0
            ? `Personal: ${myPlayer.supplies}`
            : `Ship stores: ${game.shipSupplies || 0}`),
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
