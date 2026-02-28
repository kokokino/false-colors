import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import {
  initScene,
  placeCharacters,
  updateGameState,
  disposeScene,
} from '../../3d/sceneManager.js';

// 3D game scene — Mithril component wrapping Babylon canvas
// Renders the war table, crew avatars, threat tokens, and atmospheric effects
// Attrs: game, myPlayer, messages
export const GameScene = {
  oninit(vnode) {
    this.sceneReady = false;
    this.loadingMessage = 'Initializing 3D scene...';
    this.error = null;
    this.charactersPlaced = false;
  },

  async oncreate(vnode) {
    const canvas = vnode.dom.querySelector('.game-scene-canvas');
    if (!canvas) {
      return;
    }

    try {
      await initScene(canvas, (msg) => {
        this.loadingMessage = msg;
        m.redraw();
      });

      this.sceneReady = true;
      this.loadingMessage = null;
      m.redraw();

      // Place characters if game data is already available
      const { game, myPlayer } = vnode.attrs;
      if (game && game.players) {
        await placeCharacters(game.players, myPlayer?.seatIndex);
        this.charactersPlaced = true;
        updateGameState(game, myPlayer?.seatIndex);
      }
    } catch (err) {
      console.error('[GameScene] Failed to initialize:', err);
      this.error = err.message;
      m.redraw();
    }
  },

  async onupdate(vnode) {
    if (!this.sceneReady) {
      return;
    }

    const { game, myPlayer } = vnode.attrs;
    if (!game) {
      return;
    }

    // Place characters once game data arrives
    if (!this.charactersPlaced && game.players) {
      await placeCharacters(game.players, myPlayer?.seatIndex);
      this.charactersPlaced = true;
    }

    // Update scene state reactively
    updateGameState(game, myPlayer?.seatIndex);
  },

  onremove() {
    disposeScene();
    this.sceneReady = false;
    this.charactersPlaced = false;
  },

  view(vnode) {
    const { game } = vnode.attrs;

    return m('div.game-scene-container', [
      // Babylon canvas (always rendered, takes full container)
      m('canvas.game-scene-canvas', {
        // Touch-action none needed for Babylon pointer events
        style: { touchAction: 'none' },
      }),

      // Loading overlay
      !this.sceneReady && !this.error
        ? m('div.scene-loading-overlay', [
            m('div.loading'),
            this.loadingMessage
              ? m('p.muted', this.loadingMessage)
              : null,
          ])
        : null,

      // Error overlay
      this.error
        ? m('div.scene-error-overlay', [
            m('p.error-message', `3D scene failed to load: ${this.error}`),
            m('p.muted', 'Try switching to text view.'),
          ])
        : null,
    ]);
  },
};
