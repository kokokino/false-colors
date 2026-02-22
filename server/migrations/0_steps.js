import { Migrations } from 'meteor/quave:migrations';

// Import migration steps
import './1_create_used_nonces_ttl_index.js';
import './2_create_game_indexes.js';

// Run migrations on startup
Migrations.migrateTo('latest');
