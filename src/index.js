const SyncObject = require("./SyncObject");
const { EVT_UPDATED, EVT_DESTROYED /* KEY_DELETE */ } = SyncObject;

const BidirectionalSyncObject = require("./BidirectionalSyncObject");
const {
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = BidirectionalSyncObject;

module.exports = SyncObject;
module.exports.EVT_UPDATED = EVT_UPDATED;
module.exports.EVT_DESTROYED = EVT_DESTROYED;
// module.exports.KEY_DELETE = KEY_DELETE;

module.exports.BidirectionalSyncObject = BidirectionalSyncObject;
module.exports.EVT_WRITABLE_PARTIAL_SYNC = EVT_WRITABLE_PARTIAL_SYNC;
module.exports.EVT_WRITABLE_FULL_SYNC = EVT_WRITABLE_FULL_SYNC;
module.exports.EVT_READ_ONLY_SYNC_UPDATE_HASH = EVT_READ_ONLY_SYNC_UPDATE_HASH;
