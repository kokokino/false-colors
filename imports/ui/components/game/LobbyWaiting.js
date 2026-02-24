import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { CountdownTimer } from './CountdownTimer.js';
import { GameConstants } from '../../../lib/collections/games.js';

// Lobby waiting screen — shows player list and countdown to game start
// Attrs: room (reactive GameRooms document)
export const LobbyWaiting = {
  oninit() {
    this.localExpert = null;
  },
  view(vnode) {
    const room = vnode.attrs.room;
    if (!room) {
      return m('div.loading');
    }

    const countdownDeadline = room.countdownStartedAt
      ? new Date(new Date(room.countdownStartedAt).getTime() + GameConstants.COUNTDOWN_SECONDS * 1000)
      : null;

    return m('article.lobby-waiting', [
      m('header', [
        m('h2', 'Waiting for Crew'),
        room.status === 'waiting' && countdownDeadline
          ? m(CountdownTimer, { deadline: countdownDeadline, label: 'Setting sail in' })
          : m('span', 'Starting...'),
      ]),

      m('p', `${room.players.length} / ${room.maxPlayers} crew members aboard`),

      m('ul.player-list', room.players.map(player =>
        m('li', { key: player.userId }, [
          m('strong', player.username),
          player.userId === room.hostId ? m('small', ' (Host)') : null,
        ])
      )),

      m('p.muted', 'AI crew members will fill empty seats when the countdown ends.'),

      (() => {
        const serverExpert = Meteor.user()?.isExpertPlayer || false;
        if (this.localExpert !== null && this.localExpert === serverExpert) {
          this.localExpert = null;
        }
        const expertChecked = this.localExpert !== null ? this.localExpert : serverExpert;
        return m('label', [
          m('input', {
            type: 'checkbox',
            role: 'switch',
            checked: expertChecked,
            onchange: (e) => {
              this.localExpert = e.target.checked;
              Meteor.callAsync('user.setExpertMode', e.target.checked);
            },
          }),
          ' Expert Mode (shorter timers, no guide tooltips)',
        ]);
      })(),

      m('button.secondary.outline', {
        onclick() {
          Meteor.callAsync('rooms.leave', room._id).then(() => {
            m.route.set('/');
          });
        },
      }, 'Leave Crew'),
    ]);
  },
};
