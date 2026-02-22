import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { checkSubscription } from '../imports/hub/subscriptions.js';

Meteor.methods({
  // Get current user's subscription status
  async 'user.getSubscriptionStatus'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }
    
    const user = await Meteor.users.findOneAsync(this.userId);
    if (!user) {
      throw new Meteor.Error('not-found', 'User not found');
    }
    
    return {
      subscriptions: user.subscriptions || [],
      hubUserId: user.services?.sso?.hubUserId
    };
  },
  
  // Check if user has required subscription
  async 'user.hasAccess'(requiredProductSlugs) {
    check(requiredProductSlugs, Match.Optional([String]));

    if (!this.userId) {
      return false;
    }

    const products = requiredProductSlugs || Meteor.settings.public?.requiredProducts || [];
    
    if (products.length === 0) {
      return true; // No subscription required
    }
    
    return await checkSubscription(this.userId, products);
  }
});
