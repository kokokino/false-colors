import m from 'mithril';

const resultMessages = {
  loyal_win: 'The loyal crew prevails!',
  phantom_win: 'The phantom has doomed the ship!',
  doom_loss: 'Doom has consumed the vessel. All is lost.',
  crew_loss: 'You reached the Sunken Crown, but the voyage cost too much.',
};

const reasonMessages = {
  survived_all_rounds: 'The crew survived all rounds and reached the Sunken Crown.',
  all_threats_cleared: 'Every threat was conquered. The seas are calm.',
  doom_threshold: 'Doom reached the breaking point. The ship is lost.',
  skulls_exceed_coins: 'Too many skulls accumulated — the voyage was a pyrrhic victory.',
};

const roleNames = {
  navigator: 'Navigator',
  gunner: 'Gunner',
  surgeon: 'Surgeon',
  quartermaster: 'Quartermaster',
  lookout: 'Lookout',
  cook: 'Cook',
};

// Game over screen with scoring
// Attrs: game, myUserId
export const GameOverScreen = {
  view(vnode) {
    const game = vnode.attrs.game;
    const myUserId = vnode.attrs.myUserId;
    const isVictory = game.result === 'loyal_win';
    const coins = (game.goldCoins || []).length;
    const skulls = (game.skulls || []).length;

    return m('div.game-over', [
      m('article', [
        m('header', [
          m('h2', isVictory ? 'Victory' : 'Defeat'),
        ]),
        m('p.result-text', resultMessages[
          (game.result === 'phantom_win' && !game.players?.some(p => p.alignment === 'phantom'))
            ? 'doom_loss'
            : game.result
        ] || 'The game has ended.'),
        m('p.reason-text', reasonMessages[game.endReason] || ''),

        m('div.final-stats', [
          m('p', `Final doom: ${game.doomLevel} / ${game.doomThreshold}`),
          m('p', `Rounds completed: ${game.currentRound} / ${game.maxRounds}`),
          m('p', `Threats defeated: ${game.threatsDefeated || 0}`),
          m('p', `Threats remaining: ${game.activeThreats.length}`),
        ]),

        m('div.scoring-final', [
          m('h3', 'Voyage Score'),
          m('div.score-summary', [
            m('span.coins-final', `Gold Coins: ${coins}`),
            m('span.skulls-final', `Skulls: ${skulls}`),
          ]),
          coins > 0 ? m('details', [
            m('summary', 'Gold Coins earned'),
            m('ul', (game.goldCoins || []).map((c, i) =>
              m('li', { key: i }, `Round ${c.round}: ${c.description}`)
            )),
          ]) : null,
          skulls > 0 ? m('details', [
            m('summary', 'Skulls accumulated'),
            m('ul', (game.skulls || []).map((s, i) =>
              m('li', { key: i }, `Round ${s.round}: ${s.description}`)
            )),
          ]) : null,
        ]),

        m('h3', 'Crew Manifest'),
        m('ul.crew-manifest', game.players.map(player => {
          const isMe = player.userId === myUserId;
          const classes = [
            player.alignment === 'phantom' ? 'phantom-reveal' : '',
            isMe ? 'is-self' : '',
          ].filter(Boolean).join(' ');

          return m('li', {
            key: player.seatIndex,
            class: classes,
          }, [
            m('strong', player.displayName),
            isMe ? m('mark.you-badge', 'YOU') : null,
            m('span', ` — ${roleNames[player.role] || player.role}`),
            player.alignment === 'phantom'
              ? m('mark', ' Phantom')
              : m('small', ' Loyal'),
          ]);
        })),

        m('button', {
          onclick() {
            m.route.set('/');
          },
        }, 'Return to Port'),
      ]),
    ]);
  },
};
