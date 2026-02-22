import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';

// Limit subscription methods: 5 calls per 10 seconds per connection
DDPRateLimiter.addRule({
  type: 'method',
  name: 'user.getSubscriptionStatus'
}, 5, 10000);

// Game room methods
DDPRateLimiter.addRule({
  type: 'method',
  name: 'matchmaking.findOrCreate',
  userId: () => true
}, 5, 10000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'rooms.touch',
  userId: () => true
}, 2, 60000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'rooms.leave',
  userId: () => true
}, 5, 10000);

// Game action methods
DDPRateLimiter.addRule({
  type: 'method',
  name: 'game.submitToll',
  userId: () => true
}, 5, 10000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'game.submitAction',
  userId: () => true
}, 5, 10000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'game.sendMessage',
  userId: () => true
}, 10, 10000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'game.accuse',
  userId: () => true
}, 3, 10000);

DDPRateLimiter.addRule({
  type: 'method',
  name: 'game.voteAccusation',
  userId: () => true
}, 5, 10000);
