import m from 'mithril';

const resultMessages = {
  loyal_win: 'The loyal crew prevails!',
  phantom_win: 'The phantom has doomed the ship!',
  doom_loss: 'The doom has consumed the vessel. All is lost.',
};

const reasonMessages = {
  phantom_caught: 'The phantom was unmasked and thrown overboard.',
  survived_all_rounds: 'The crew survived all rounds and reached safe harbor.',
  all_threats_cleared: 'Every threat was conquered. The seas are calm.',
  doom_threshold: 'Doom reached the breaking point. The ship is lost.',
};

const roleNames = {
  navigator: 'Navigator',
  gunner: 'Gunner',
  surgeon: 'Surgeon',
  quartermaster: 'Quartermaster',
  lookout: 'Lookout',
  cook: 'Cook',
};

// Game over screen
// Attrs: game
export const GameOverScreen = {
  view(vnode) {
    const game = vnode.attrs.game;
    const isVictory = game.result === 'loyal_win';

    return m('div.game-over', [
      m('article', [
        m('header', [
          m('h2', isVictory ? 'Victory' : 'Defeat'),
        ]),
        m('p.result-text', resultMessages[game.result] || 'The game has ended.'),
        m('p.reason-text', reasonMessages[game.endReason] || ''),

        m('div.final-stats', [
          m('p', `Final doom: ${game.doomLevel} / ${game.doomThreshold}`),
          m('p', `Rounds completed: ${game.currentRound} / ${game.maxRounds}`),
          m('p', `Threats remaining: ${game.activeThreats.length}`),
        ]),

        m('h3', 'Crew Manifest'),
        m('ul.crew-manifest', game.players.map(player =>
          m('li', {
            key: player.seatIndex,
            class: player.alignment === 'phantom' ? 'phantom-reveal' : '',
          }, [
            m('strong', player.displayName),
            m('span', ` — ${roleNames[player.role] || player.role}`),
            player.alignment === 'phantom'
              ? m('mark', ' Phantom')
              : m('small', ' Loyal'),
          ])
        )),

        m('button', {
          onclick() {
            m.route.set('/');
          },
        }, 'Return to Port'),
      ]),
    ]);
  },
};
