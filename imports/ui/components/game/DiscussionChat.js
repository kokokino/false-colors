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
  },

  oncreate() {
    this.scrollToBottom();
  },

  onupdate() {
    this.scrollToBottom();
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

    return m('div.phase-content.discussion-chat', [
      m('h3', 'Discussion'),

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
};
