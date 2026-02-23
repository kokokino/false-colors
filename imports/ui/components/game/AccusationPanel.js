import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Accusation and voting panel — one accusation per player per game
// Attrs: game, myPlayer
export const AccusationPanel = {
  oninit() {
    this.error = null;
    this.voted = false;
    this.accused = false;
    this.readySubmitted = false;
  },

  view(vnode) {
    const { game, myPlayer } = vnode.attrs;
    const accusation = game.accusation;

    // If there's an active accusation, show voting UI
    if (accusation && !accusation.resolved) {
      return this.renderVoting(game, myPlayer, accusation);
    }

    // If accusation was resolved, show result
    if (accusation && accusation.resolved) {
      return this.renderResult(game, accusation);
    }

    // No accusation — show accusation option
    return this.renderAccuseOption(game, myPlayer);
  },

  renderAccuseOption(game, myPlayer) {
    const canAccuse = !this.accused &&
      !myPlayer.hasAccused &&
      myPlayer.hasNextAction &&
      !myPlayer.phantomRevealed &&
      game.currentRound >= 3;

    if (!canAccuse) {
      const reason = game.currentRound < 3
        ? `Accusations begin in round 3 (current: round ${game.currentRound}).`
        : myPlayer.hasAccused
          ? 'You have already used your accusation this game.'
          : myPlayer.phantomRevealed
            ? 'Revealed phantoms cannot accuse.'
            : 'Waiting for accusations or timer to expire...';

      return m('div.phase-content.accusation-panel', [
        m('h3', 'Accusations'),
        m('p', reason),
        !this.readySubmitted
          ? m('button.outline', { onclick: () => this.markReady(game._id) }, 'Ready to move on')
          : m('p.muted', 'Waiting for other crew members...'),
      ]);
    }

    const otherPlayers = game.players.filter(p => p.seatIndex !== myPlayer.seatIndex && !p.phantomRevealed);

    return m('div.phase-content.accusation-panel', [
      m('h3', 'Accusations'),
      m('p', [
        'You get ',
        m('strong', 'ONE accusation'),
        ' for the entire game. Wrong = +3 doom and a skull.',
      ]),

      this.error ? m('p.error-message', this.error) : null,

      m('div.accuse-targets', otherPlayers.map(player =>
        m('button.outline', {
          key: player.seatIndex,
          onclick: () => this.makeAccusation(game._id, player.seatIndex),
        }, `Accuse ${player.displayName}`)
      )),

      m('p.muted', 'Or do nothing — the phase will end automatically.'),

      !this.readySubmitted
        ? m('button.outline', { onclick: () => this.markReady(game._id) }, 'Ready to move on')
        : null,
    ]);
  },

  renderVoting(game, myPlayer, accusation) {
    const accuser = game.players.find(p => p.seatIndex === accusation.accuserSeat);
    const target = game.players.find(p => p.seatIndex === accusation.targetSeat);
    const canVote = myPlayer.seatIndex !== accusation.accuserSeat &&
                    myPlayer.seatIndex !== accusation.targetSeat &&
                    !this.voted;

    return m('div.phase-content.accusation-panel', [
      m('h3', 'Vote on Accusation'),
      m('p', [
        m('strong', accuser?.displayName || 'Someone'),
        ' accuses ',
        m('strong', target?.displayName || 'someone'),
        ' of being the phantom!',
      ]),
      m('p.warning', 'Wrong accusation: +3 doom, +1 skull, accuser loses next action.'),

      this.error ? m('p.error-message', this.error) : null,

      canVote ? m('div.vote-buttons', [
        m('button', { onclick: () => this.vote(game._id, true) }, 'Guilty'),
        m('button.secondary', { onclick: () => this.vote(game._id, false) }, 'Not Guilty'),
      ]) : m('p', this.voted ? 'Your vote has been cast.' : 'You cannot vote on this accusation.'),

      m('small', `Votes cast: ${accusation.votes?.length || 0} / ${game.players.length - 2}`),
    ]);
  },

  renderResult(game, accusation) {
    const target = game.players.find(p => p.seatIndex === accusation.targetSeat);
    return m('div.phase-content.accusation-panel', [
      m('h3', 'Accusation Result'),
      m('p', accusation.correct
        ? `${target?.displayName || 'The accused'} was indeed the phantom! They are revealed but remain aboard. Doom reduced by 3.`
        : `${target?.displayName || 'The accused'} was loyal. +3 doom added. The accuser loses their next action.`
      ),
      !this.readySubmitted
        ? m('button.outline', { onclick: () => this.markReady(game._id) }, 'Ready to move on')
        : m('p.muted', 'Waiting for other crew members...'),
    ]);
  },

  async makeAccusation(gameId, targetSeat) {
    this.error = null;
    try {
      await Meteor.callAsync('game.accuse', gameId, targetSeat);
      this.accused = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },

  async vote(gameId, guilty) {
    this.error = null;
    try {
      await Meteor.callAsync('game.voteAccusation', gameId, guilty);
      this.voted = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },

  async markReady(gameId) {
    try {
      await Meteor.callAsync('game.readyToAdvance', gameId);
      this.readySubmitted = true;
    } catch (error) {
      this.error = error.reason || error.message;
    }
    m.redraw();
  },
};
