import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { GameRooms } from '../../lib/collections/games.js';
import { RequireAuth } from '../components/RequireAuth.js';
import { RequireSubscription } from '../components/RequireSubscription.js';
import { LobbyWaiting } from '../components/game/LobbyWaiting.js';
import { GameBoard } from '../components/game/GameBoard.js';

const GameContent = {
  oninit(vnode) {
    this.room = null;
    this.sub = null;
    this.subReady = false;
    this.computation = null;
  },

  oncreate(vnode) {
    const roomId = m.route.param('roomId');

    this.sub = Meteor.subscribe('rooms.current', roomId);
    this.computation = Tracker.autorun(() => {
      this.subReady = this.sub.ready();
      this.room = GameRooms.findOne(roomId);
      m.redraw();
    });
  },

  onremove() {
    if (this.sub) {
      this.sub.stop();
    }
    if (this.computation) {
      this.computation.stop();
    }
  },

  view() {
    const room = this.room;

    if (!room) {
      if (this.subReady) {
        return m('div', [
          m('h2', 'Room not found'),
          m('p', 'This room may have been closed.'),
          m('a', { href: '/', oncreate: m.route.link }, 'Return to lobby'),
        ]);
      }
      return m('div.loading');
    }

    // Waiting for more players or countdown
    if (room.status === 'waiting') {
      return m(LobbyWaiting, { room });
    }

    // Starting (brief transition)
    if (room.status === 'starting') {
      return m('div', [
        m('h2', 'Preparing the voyage...'),
        m('div.loading'),
      ]);
    }

    // Game in progress or finished — delegate to GameBoard
    if (room.gameId) {
      return m(GameBoard, { gameId: room.gameId });
    }

    // Fallback — room exists but no game yet
    return m('div', [
      m('h2', 'Setting sail...'),
      m('div.loading'),
    ]);
  },
};

export const GamePage = {
  view() {
    return m(RequireAuth,
      m(RequireSubscription,
        m(GameContent)
      )
    );
  },
};
