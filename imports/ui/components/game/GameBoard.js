import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Games, GameMessages, GameLog } from '../../../lib/collections/games.js';
import { GameHeader } from './GameHeader.js';
import { ThreatDisplay } from './ThreatDisplay.js';
import { PlayerPanel } from './PlayerPanel.js';
import { PhasePanel } from './PhasePanel.js';
import { GameLogPanel } from './GameLogPanel.js';
import { GameOverScreen } from './GameOverScreen.js';

// Main game board component — subscribes to game data and orchestrates sub-components
// Attrs: gameId
export const GameBoard = {
  oninit(vnode) {
    this.game = null;
    this.messages = [];
    this.logs = [];
    this.subs = [];
    this.computations = [];
    this.heartbeatInterval = null;
  },

  oncreate(vnode) {
    const gameId = vnode.attrs.gameId;

    // Subscribe to game data
    const gameSub = Meteor.subscribe('game', gameId);
    const msgSub = Meteor.subscribe('gameMessages', gameId);
    const logSub = Meteor.subscribe('gameLog', gameId);
    this.subs = [gameSub, msgSub, logSub];

    // Reactive computation for game data
    this.computations.push(Tracker.autorun(() => {
      this.game = Games.findOne(gameId);
      this.messages = GameMessages.find({ gameId }, { sort: { createdAt: 1 } }).fetch();
      this.logs = GameLog.find({ gameId }, { sort: { createdAt: 1 } }).fetch();
      m.redraw();
    }));

    // Heartbeat for room
    this.startHeartbeat(vnode);

    // Beforeunload handler
    this._onBeforeUnload = () => {
      if (this.game?.roomId) {
        navigator.sendBeacon && Meteor.callAsync('rooms.touch', this.game.roomId);
      }
    };
    window.addEventListener('beforeunload', this._onBeforeUnload);
  },

  onremove() {
    for (const sub of this.subs) {
      sub.stop();
    }
    for (const comp of this.computations) {
      comp.stop();
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    window.removeEventListener('beforeunload', this._onBeforeUnload);
  },

  startHeartbeat(vnode) {
    this.heartbeatInterval = setInterval(() => {
      if (this.game?.roomId) {
        Meteor.callAsync('rooms.touch', this.game.roomId).catch(err => console.warn('[heartbeat]', err.message));
      }
    }, 120000); // 2 minutes
  },

  view(vnode) {
    const game = this.game;

    if (!game) {
      return m('div.loading');
    }

    // Find current player's seat
    const myPlayer = game.players.find(p => p.userId === Meteor.userId());

    // Game over screen
    if (game.currentPhase === 'finished') {
      return m('div.game-container', [
        m(GameOverScreen, { game }),
      ]);
    }

    return m('div.game-container', [
      m(GameHeader, { game }),

      m('div.game-layout', [
        m('div.game-main', [
          m(ThreatDisplay, { threats: game.activeThreats }),
          m(PhasePanel, { game, myPlayer, messages: this.messages }),
        ]),

        m('div.game-sidebar', [
          m(PlayerPanel, {
            players: game.players,
            currentSeat: myPlayer?.seatIndex,
          }),
          m(GameLogPanel, { logs: this.logs }),
        ]),
      ]),
    ]);
  },
};
