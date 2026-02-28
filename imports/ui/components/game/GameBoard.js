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
import { GameScene } from './GameScene.js';

const VIEW_STORAGE_KEY = 'falseColors_viewMode';

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
    // View mode: '3d' or 'text' — persisted in localStorage
    this.viewMode = localStorage.getItem(VIEW_STORAGE_KEY) || 'text';
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
    const expertMode = user?.isExpertPlayer || false;

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
    // Expert players skip GameIntro, so also show when showIntro is still true in expert mode
    if (this.showCharacterCard && (!this.showIntro || expertMode) && game.currentRound === 1 && myPlayer) {
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

    // View toggle button
    const viewToggle = m('button.view-toggle.outline.secondary', {
      onclick: () => {
        this.viewMode = this.viewMode === '3d' ? 'text' : '3d';
        localStorage.setItem(VIEW_STORAGE_KEY, this.viewMode);
      },
    }, this.viewMode === '3d' ? 'Text View' : '3D View');

    // 3D view — full scene with overlay panels
    if (this.viewMode === '3d') {
      return m('div.game-container.game-container-3d', [
        cardOverlay,

        // Babylon canvas fills the container
        m(GameScene, {
          key: 'game-scene-3d',
          game,
          myPlayer,
          messages: this.messages,
        }),

        // Overlay panels positioned on top of the canvas
        m('div.scene-overlay', [
          m('div.scene-overlay-top', [
            m(GameHeader, {
              game,
              myPlayer,
              onViewCard: () => { this.showCharacterCard = true; },
            }),
            viewToggle,
          ]),

          m(GuideTooltip, { phase: game.currentPhase, expertMode }),

          // Bottom overlay — phase panel and sidebar
          m('div.scene-overlay-bottom', [
            m('div.scene-overlay-main', [
              m(PhasePanel, { game, myPlayer, messages: this.messages }),
            ]),

            m('div.scene-overlay-sidebar', [
              m(PlayerPanel, {
                players: game.players,
                currentSeat: myPlayer?.seatIndex,
                onViewPlayer: (player) => {
                  if (myPlayer && player.seatIndex === myPlayer.seatIndex) {
                    this.showCharacterCard = true;
                  } else {
                    this.viewingPlayer = player;
                  }
                },
              }),
            ]),
          ]),
        ]),
      ]);
    }

    // Text view — existing UI unchanged
    return m('div.game-container', [
      cardOverlay,
      m(GameHeader, {
        game,
        myPlayer,
        onViewCard: () => { this.showCharacterCard = true; },
      }),
      viewToggle,
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
            onViewPlayer: (player) => {
              if (myPlayer && player.seatIndex === myPlayer.seatIndex) {
                this.showCharacterCard = true;
              } else {
                this.viewingPlayer = player;
              }
            },
          }),
          m(GameHistory, { logs: this.logs, game }),
          m(GameLogPanel, { logs: this.logs }),
        ]),
      ]),
    ]);
  },
};
