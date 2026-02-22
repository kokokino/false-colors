import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { CountdownTimer } from './CountdownTimer.js';

// Lobby waiting screen — shows player list and countdown to game start
// Attrs: room (reactive GameRooms document)
export const LobbyWaiting = {
  view(vnode) {
    const room = vnode.attrs.room;
    if (!room) {
      return m('div.loading');
    }

    const countdownDeadline = room.countdownStartedAt
      ? new Date(new Date(room.countdownStartedAt).getTime() + 20000)
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
          player.userId === room.hostId ? m('small', ' (Captain)') : null,
        ])
      )),

      m('p.muted', 'AI crew members will fill empty seats when the countdown ends.'),

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
