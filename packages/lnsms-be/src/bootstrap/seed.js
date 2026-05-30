const Store = require('../models/Store');
const SetConfig = require('../models/SetConfig');

async function seedGreenfield() {
  const guestPassword = process.env.LOCAL_GUEST_PASSWORD || 'guest';

  let guest = await Store.findOne({ userid: 'necall', storeId: 'guest' });
  if (!guest) {
    guest = new Store({
      userid: 'necall',
      storeId: 'guest',
      name: 'Guest (Local)',
      userpw: guestPassword,
    });
    await guest.save();
    console.log('✅ seed: store necall.guest');
  }

  let setCfg = await SetConfig.findOne({ userid: 'necall', storeId: 'guest', setid: 'default' });
  if (!setCfg) {
    setCfg = new SetConfig({
      userid: 'necall',
      storeId: 'guest',
      setid: 'default',
      phrases: {},
      serial: { ports: [] },
    });
    await setCfg.save();
    console.log('✅ seed: set_config necall.guest/default');
  }
}

module.exports = { seedGreenfield };
