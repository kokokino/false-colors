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
      !game.expertMode ? m('p.muted', 'Your crew will vote on whether to convict. If they vote Not Guilty, the accusation is cancelled \u2014 no penalty for anyone.') : null,

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
      !game.expertMode ? m('p.muted', 'Vote Guilty if you believe the accusation. Vote Not Guilty to acquit \u2014 if acquitted, no penalty is applied and the accusation is cancelled.') : null,

      this.error ? m('p.error-message', this.error) : null,

      canVote ? m('div.vote-buttons', [
        m('button', { onclick: () => this.vote(game._id, true) }, 'Guilty'),
        m('button.secondary', { onclick: () => this.vote(game._id, false) }, 'Not Guilty'),
      ]) : m('p', this.voted ? 'Your vote has been cast.' : 'You cannot vote on this accusation.'),

      m('small', `Votes cast: ${accusation.votes?.length || 0} / ${game.players.length - 2}`),
    ]);
  },

  renderResult(game, accusation) {
    // Reset ready state so button appears for the result display period
    if (!this._resultSeen) {
      this._resultSeen = true;
      this.readySubmitted = false;
    }

    const target = game.players.find(p => p.seatIndex === accusation.targetSeat);
    const targetName = target?.displayName || 'The accused';

    let message;
    if (!accusation.convicted) {
      message = `The crew voted to acquit ${targetName}. No penalty applied.`;
    } else if (accusation.correct) {
      message = `${targetName} was indeed the phantom! They are revealed but remain aboard. Doom reduced by 3.`;
    } else {
      message = `${targetName} was loyal. +3 doom added, +1 skull. The accuser loses their next action.`;
    }

    // Vote tally
    const votes = accusation.votes || [];
    const guiltyCount = votes.filter(v => v.guilty).length;
    const notGuiltyCount = votes.filter(v => !v.guilty).length;

    // Per-player vote list
    const voteEntries = votes.map(v => {
      const voter = game.players.find(p => p.seatIndex === v.seatIndex);
      return { name: voter?.displayName || 'Unknown', guilty: v.guilty };
    });

    return m('div.phase-content.accusation-panel', [
      m('h3', 'Accusation Result'),
      accusation.correct ? m('mark', 'PHANTOM REVEALED') : null,
      m('p', message),
      m('p', [
        m('strong', `Guilty: ${guiltyCount}`),
        ' — ',
        m('strong', `Not Guilty: ${notGuiltyCount}`),
      ]),
      votes.length > 0 ? m('ul.vote-breakdown', voteEntries.map(entry =>
        m('li', { key: entry.name }, [
          entry.name, ' — ', entry.guilty ? 'Guilty' : 'Not Guilty',
        ])
      )) : null,
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
