import { Mongo } from 'meteor/mongo';

export const UsedNonces = new Mongo.Collection('usedNonces');
export const SubscriptionCache = new Mongo.Collection('subscriptionCache');

// Game collections
export const GameRooms = new Mongo.Collection('gameRooms');
export const Games = new Mongo.Collection('games');
export const GameMessages = new Mongo.Collection('gameMessages');
export const GameLog = new Mongo.Collection('gameLogs');
