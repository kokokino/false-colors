import m from 'mithril';
import { Meteor } from 'meteor/meteor';
import { ChatRoom } from '../components/ChatRoom.js';
import { RequireAuth } from '../components/RequireAuth.js';

const HomeContent = {
  view() {
    return m('div', [
      m('h1', 'Welcome to False Colors'),
      m('p', 'A cooperative social deduction game for 4-6 players. Can you unmask the traitor before it\'s too late? The demo chat below is a placeholder for the game interface.'),
      
      m('article', [
        m('header', m('h2', 'Demo Chat Room')),
        m('p', 'This chat demonstrates real-time Meteor publications. Messages are stored in-memory and will be lost when the server restarts.'),
        m(ChatRoom)
      ])
    ]);
  }
};

export const HomePage = {
  view() {
    return m(RequireAuth, m(HomeContent));
  }
};
