import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { RequireAuth } from '../components/RequireAuth.js';

const HomeContent = {
  oninit() {
    this.joining = false;
    this.error = null;
  },

  view() {
    return m('div', [
      m('h1', 'False Colors'),
      m('p', 'A cooperative social deduction game for 4-6 players. Crew a ghost ship through cursed waters — but one among you may be a phantom traitor.'),

      m('article', [
        m('header', m('h2', 'Phantom Tides')),
        m('p', 'Your vessel sails cursed seas. Each round brings new threats — fog, krakens, storms, and plague. The crew must work together to survive, but the phantom among you secretly sabotages your efforts.'),
        m('ul', [
          m('li', 'Pay tolls, assign actions, and discuss strategy with your crew'),
          m('li', 'AI crew members fill empty seats — can you tell who\'s human?'),
          m('li', 'Accuse the phantom before doom overwhelms the ship'),
        ]),

        this.error ? m('p.error-message', this.error) : null,

        m('button', {
          onclick: () => this.joinGame(),
          disabled: this.joining,
          'aria-busy': this.joining,
        }, this.joining ? 'Finding crew...' : 'Set Sail'),
      ]),
    ]);
  },

  async joinGame() {
    this.joining = true;
    this.error = null;
    m.redraw();

    try {
      const result = await Meteor.callAsync('matchmaking.findOrCreate');

      if (result.alreadyPlaying) {
        m.route.set(`/game/${result.roomId}`);
        return;
      }

      m.route.set(`/game/${result.roomId}`);
    } catch (error) {
      this.error = error.reason || error.message;
      this.joining = false;
    }
    m.redraw();
  },
};

export const HomePage = {
  view() {
    return m(RequireAuth, m(HomeContent));
  },
};
