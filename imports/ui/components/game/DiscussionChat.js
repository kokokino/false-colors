import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { GameConstants } from '../../../lib/collections/games.js';

// In-game discussion chat during DISCUSSION phase
// Attrs: game, myPlayer, messages (array)
export const DiscussionChat = {
  oninit() {
    this.newMessage = '';
    this.sending = false;
    this.error = null;
    this.readySubmitted = false;
    this.prevMessageCount = 0;
  },

  oncreate() {
    this.scrollToBottom();
  },

  onupdate(vnode) {
    const messages = vnode.attrs.messages || [];
    const roundMessages = messages.filter(msg => msg.round === vnode.attrs.game.currentRound);
    if (roundMessages.length !== this.prevMessageCount) {
      this.prevMessageCount = roundMessages.length;
      const container = document.querySelector('.discussion-messages');
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  },

  scrollToBottom() {
    const container = document.querySelector('.discussion-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  view(vnode) {
    const { game, myPlayer, messages } = vnode.attrs;
    const roundMessages = (messages || []).filter(msg => msg.round === game.currentRound);
    const tollAgg = game.tollAggregate;

    return m('div.phase-content.discussion-chat', [
      m('h3', 'Discussion'),

      // Show toll aggregate at top
      tollAgg ? m('div.toll-summary', [
        m('small', `This round's tolls: ${tollAgg.resolveCount} sacrificed resolve, ${tollAgg.doomCount} chose doom, ${tollAgg.curseCount} drew a curse.`),
        // Show curse details
        tollAgg.curseDetails && tollAgg.curseDetails.length > 0 ? tollAgg.curseDetails.map(cd => {
          const isSelf = cd.seatIndex === myPlayer.seatIndex;
          const cursePlayer = game.players.find(p => p.seatIndex === cd.seatIndex);
          const playerName = cursePlayer ? cursePlayer.displayName : 'Unknown';
          if (isSelf) {
            return m('div.curse-drawn-self', { key: cd.curseId }, [
              m('strong', `You drew: ${cd.curseName}`),
              m('br'),
              m('small', cd.curseDescription),
            ]);
          }
          return m('div.curse-drawn-notice', { key: `${cd.seatIndex}-${cd.curseId}` },
            `${playerName} drew a curse: ${cd.curseName}`
          );
        }) : null,
      ]) : null,

      m('div.discussion-messages', roundMessages.map(msg =>
        m('div.disc-message', {
          key: msg._id,
          class: msg.seatIndex === myPlayer.seatIndex ? 'own-message' : '',
        }, [
          m('span.disc-name', msg.displayName),
          m('span.disc-text', msg.text),
        ])
      )),

      this.error ? m('p.error-message', this.error) : null,

      m('form.disc-input-form', {
        onsubmit: (e) => {
          e.preventDefault();
          this.sendMessage(game._id);
        },
      }, [
        m('div[role=group]', [
          m('input[type=text]', {
            placeholder: 'Say something to the crew...',
            value: this.newMessage,
            oninput: (e) => { this.newMessage = e.target.value; },
            disabled: this.sending,
            maxlength: GameConstants.CHAT_MAX_LENGTH,
          }),
          m('button[type=submit]', { disabled: this.sending || !this.newMessage.trim() }, 'Send'),
        ]),
      ]),

      // Ready to move on button
      !this.readySubmitted ? m('button.outline', {
        onclick: () => this.markReady(game._id),
      }, 'Ready to move on') : m('p.muted', 'Waiting for other crew members...'),
    ]);
  },

  async sendMessage(gameId) {
    const text = this.newMessage.trim();
    if (!text) {
      return;
    }
    this.sending = true;
    this.error = null;
    try {
      await Meteor.callAsync('game.sendMessage', gameId, text);
      this.newMessage = '';
    } catch (error) {
      this.error = error.reason || error.message;
    }
    this.sending = false;
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
