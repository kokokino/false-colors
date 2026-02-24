import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Games, GameMessages, GameLog, GameConstants } from '../../../lib/collections/games.js';
import { GameHeader } from './GameHeader.js';
import { ThreatDisplay } from './ThreatDisplay.js';
import { PlayerPanel } from './PlayerPanel.js';
import { PhasePanel } from './PhasePanel.js';
import { GameLogPanel } from './GameLogPanel.js';
import { GameOverScreen } from './GameOverScreen.js';
import { GuideTooltip } from './GuideTooltip.js';
import { GameIntro } from './GameIntro.js';
import { CharacterCard } from './CharacterCard.js';
import { GameHistory } from './GameHistory.js';

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
    this.showIntro = true;
    this.showCharacterCard = true;
    this.viewingPlayer = null;
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
    }, GameConstants.HEARTBEAT_MS);
  },

  view(vnode) {
    const game = this.game;

    if (!game) {
      return m('div.loading');
    }

    // Find current player's seat
    const myPlayer = game.players.find(p => p.userId === Meteor.userId());
    const user = Meteor.user();
    const expertMode = game.expertMode || false;

    // Game intro for non-expert players
    if (this.showIntro && !expertMode && game.currentRound === 1) {
      return m(GameIntro, {
        expertMode,
        onDismiss: () => {
          this.showIntro = false;
        },
      });
    }

    // Character card auto-show after intro (round 1 only)
    if (this.showCharacterCard && !this.showIntro && game.currentRound === 1 && myPlayer) {
      return m(CharacterCard, {
        player: myPlayer,
        isSelf: true,
        onDismiss: () => {
          this.showCharacterCard = false;
        },
      });
    }

    // Game over screen
    if (game.currentPhase === 'finished') {
      return m('div.game-container', [
        m(GameOverScreen, { game, myUserId: Meteor.userId() }),
      ]);
    }

    // Character card overlay (re-open own card or view another player's card)
    const cardOverlay = this.showCharacterCard && myPlayer
      ? m(CharacterCard, {
          player: myPlayer,
          isSelf: true,
          onDismiss: () => { this.showCharacterCard = false; },
        })
      : this.viewingPlayer
        ? m(CharacterCard, {
            player: this.viewingPlayer,
            isSelf: false,
            onDismiss: () => { this.viewingPlayer = null; },
          })
        : null;

    return m('div.game-container', [
      cardOverlay,
      m(GameHeader, {
        game,
        myPlayer,
        onViewCard: () => { this.showCharacterCard = true; },
      }),
      m(GuideTooltip, { phase: game.currentPhase, expertMode }),

      m('div.game-layout', [
        m('div.game-main', [
          m(ThreatDisplay, { threats: game.activeThreats }),
          m(PhasePanel, { game, myPlayer, messages: this.messages }),
        ]),

        m('div.game-sidebar', [
          m(PlayerPanel, {
            players: game.players,
            currentSeat: myPlayer?.seatIndex,
            onViewPlayer: (player) => { this.viewingPlayer = player; },
          }),
          m(GameHistory, { logs: this.logs, game }),
          m(GameLogPanel, { logs: this.logs }),
        ]),
      ]),
    ]);
  },
};
