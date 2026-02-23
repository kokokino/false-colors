import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Round end summary with Cook nourish UI
// Attrs: game, myPlayer
export const RoundEndSummary = {
  oninit() {
    this.nourished = false;
    this.error = null;
  },

  view(vnode) {
    const game = vnode.attrs.game;
    const myPlayer = vnode.attrs.myPlayer;
    const coins = (game.goldCoins || []).length;
    const skulls = (game.skulls || []).length;

    const cook = game.players.find(p => p.role === 'cook');
    const isCook = myPlayer && cook && myPlayer.seatIndex === cook.seatIndex;
    const hasMeals = cook && (cook.mealsRemaining || 0) > 0 && !cook.phantomRevealed;

    return m('div.phase-content.round-end-summary', [
      m('h3', `Round ${game.currentRound} Complete`),
      m('div.summary-stats', [
        m('p', `Doom: ${game.doomLevel} / ${game.doomThreshold}`),
        m('p', `Active threats: ${game.activeThreats.length}`),
        m('p', `Rounds remaining: ${game.maxRounds - game.currentRound}`),
        m('p', `Gold Coins: ${coins} | Skulls: ${skulls}`),
      ]),

      // Cook nourish UI
      isCook && hasMeals && !this.nourished
        ? this.renderCookNourish(game, myPlayer, cook)
        : hasMeals && !game.lastNourishTarget
          ? m('p.muted', `Cook ${cook.displayName} may nourish a crew member. (${cook.mealsRemaining} meals left)`)
          : null,

      // Show nourish result to all players
      game.lastNourishTarget
        ? m('p', `Cook nourished ${game.lastNourishTarget}.`)
        : null,

      this.error ? m('p.error-message', this.error) : null,

      m('p.muted', 'Next round starting shortly...'),
    ]);
  },

  renderCookNourish(game, myPlayer, cook) {
    const targets = game.players.filter(p => !p.phantomRevealed);
    return m('div.cook-nourish', [
      m('h4', `Nourish a Crew Member (${cook.mealsRemaining} meals left)`),
      m('p', 'Choose a crew member to restore +1 resolve.'),
      m('div.nourish-targets', targets.map(player =>
        m('button.outline', {
          key: player.seatIndex,
          onclick: () => this.submitNourish(game._id, player.seatIndex),
        }, [
          m('span', player.displayName),
          m('small', ` (Resolve: ${player.resolve})`),
        ])
      )),
    ]);
  },

  async submitNourish(gameId, targetSeatIndex) {
    this.error = null;
    try {
      await Meteor.callAsync('game.cookNourish', gameId, targetSeatIndex);
      this.nourished = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },
};
