import { Migrations } from 'meteor/quave:migrations';
import { Meteor } from 'meteor/meteor';

Migrations.add({
  version: 3,
  name: 'Add isExpertPlayer to users, new game fields',
  async up() {
    // Add isExpertPlayer: false to all users
    const users = Meteor.users.rawCollection();
    await users.updateMany(
      { isExpertPlayer: { $exists: false } },
      { $set: { isExpertPlayer: false } }
    );
    console.log('Added isExpertPlayer to users');
  },
  async down() {
    const users = Meteor.users.rawCollection();
    await users.updateMany(
      {},
      { $unset: { isExpertPlayer: '' } }
    );
    console.log('Removed isExpertPlayer from users');
  },
});
