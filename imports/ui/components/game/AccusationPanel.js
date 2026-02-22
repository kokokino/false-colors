import m from 'mithril';
import { Meteor } from 'meteor/meteor';

// Accusation and voting panel
// Attrs: game, myPlayer
export const AccusationPanel = {
  oninit() {
    this.error = null;
    this.voted = false;
    this.accused = false;
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
    if (this.accused || !myPlayer.hasNextAction) {
      return m('div.phase-content.accusation-panel', [
        m('h3', 'Accusations'),
        m('p', 'Waiting for accusations or timer to expire...'),
      ]);
    }

    const otherPlayers = game.players.filter(p => p.seatIndex !== myPlayer.seatIndex);

    return m('div.phase-content.accusation-panel', [
      m('h3', 'Accusations'),
      m('p', 'Do you suspect someone is the phantom? Accuse them — but a wrong accusation costs your next action.'),

      this.error ? m('p.error-message', this.error) : null,

      m('div.accuse-targets', otherPlayers.map(player =>
        m('button.outline', {
          key: player.seatIndex,
          onclick: () => this.makeAccusation(game._id, player.seatIndex),
        }, `Accuse ${player.displayName}`)
      )),

      m('p.muted', 'Or do nothing — the phase will end automatically.'),
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
        ? `${target?.displayName || 'The accused'} was indeed the phantom! The crew is saved!`
        : `${target?.displayName || 'The accused'} was loyal. The accuser loses their next action.`
      ),
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
};
