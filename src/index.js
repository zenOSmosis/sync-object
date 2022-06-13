const SyncObject = require("./SyncObject");
const { EVT_UPDATE, EVT_DESTROY } = SyncObject;

const BidirectionalSyncObject = require("./BidirectionalSyncObject");
const {
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = BidirectionalSyncObject;

module.exports = SyncObject;
module.exports.EVT_UPDATE = EVT_UPDATE;
module.exports.EVT_DESTROY = EVT_DESTROY;

module.exports.BidirectionalSyncObject = BidirectionalSyncObject;
module.exports.EVT_WRITABLE_PARTIAL_SYNC = EVT_WRITABLE_PARTIAL_SYNC;
module.exports.EVT_WRITABLE_FULL_SYNC = EVT_WRITABLE_FULL_SYNC;
module.exports.EVT_READ_ONLY_SYNC_UPDATE_HASH = EVT_READ_ONLY_SYNC_UPDATE_HASH;
