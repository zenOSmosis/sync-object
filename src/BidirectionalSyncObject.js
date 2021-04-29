const PhantomBase = require("phantom-base");
const { EVT_DESTROYED } = PhantomBase;
const SyncObject = require("./SyncObject");
const { EVT_UPDATED } = SyncObject;

const EVT_WRITABLE_PARTIAL_SYNC = "writable-sync-updated";
const EVT_WRITABLE_FULL_SYNC = "writable-full-sync";
const EVT_READ_ONLY_SYNC_UPDATE_HASH = "read-only-sync-update-hash";

/**
 * Provides P2P access for SyncObject modules, using two SyncObjects, where
 * one represents the local (writable) peer and the other represents the
 * "remote" (readOnly) peer.
 */
class BidirectionalSyncObject extends PhantomBase {
  /**
   * If the optional writable or readOnly SyncObjects are not supplied, one of
   * each respective type will be automatically created and utilized during the
   * lifecycle of the class.
   *
   * @param {SyncObject} writableSyncObject? [default = null] Represents "our"
   * state.
   * @param {SyncObject} readOnlySyncObject? [default = null] Represents
   * "their" state.
   */
  constructor(writableSyncObject = null, readOnlySyncObject = null) {
    if (writableSyncObject && readOnlySyncObject) {
      if (writableSyncObject.getIsSameInstance(readOnlySyncObject)) {
        throw new Error(
          "readOnly and writable sync objects cannot be the same instance"
        );
      }
    }

    super();

    // Our state
    this._writableSyncObject = writableSyncObject || this._makeSyncObject();

    // Their state
    this._readOnlySyncObject = readOnlySyncObject || this._makeSyncObject();

    this._writableDidUpdate = this._writableDidUpdate.bind(this);

    this._writableSyncObject.on(EVT_UPDATED, this._writableDidUpdate);
  }

  /**
   * @return {Promise<void>}
   */
  async destroy() {
    this._writableSyncObject.off(EVT_UPDATED, this._writableDidUpdate);

    super.destroy();
  }

  /**
   * Creates a temporary SyncObject designed to last only the duration of this
   * P2P session.
   *
   * This is not to be used if an object of the same channel (i.e. readOnly /
   * writable) is used.
   *
   * @return {SyncObject}
   */
  _makeSyncObject() {
    const syncObject = new SyncObject();

    // Destroy the temporary SyncObject when the linker is destroyed
    this.once(EVT_DESTROYED, () => syncObject.destroy());

    return syncObject;
  }

  /**
   * @return {SyncObject}
   */
  getReadOnlySyncObject() {
    return this._readOnlySyncObject;
  }

  /**
   * @return {SyncObject}
   */
  getWritableSyncObject() {
    return this._writableSyncObject;
  }

  /**
   * Called when our own writable state has updated.
   *
   * Triggers network EVT_WRITABLE_PARTIAL_SYNC from local writable
   * SyncObject when it has been updated.
   *
   * This is handled via the writeableSyncObject.
   *
   * @param {Object} state NOTE: This state will typically be the changed
   * state, and not the full state of the calling SyncObject.
   * @return void
   */
  _writableDidUpdate(state) {
    // Perform sync
    this.emit(EVT_WRITABLE_PARTIAL_SYNC, state);
  }

  /**
   *
   * @param {Object} state Partial, or full state, depending on isMerge value.
   * @param {boolean} isMerge If true, state is a partial state. If false, the
   * entire local state will be overwritten.
   * @return void
   */
  receiveReadOnlyState(state, isMerge = true) {
    this._readOnlySyncObject.setState(state, isMerge);

    const ourFullStateHash = this._readOnlySyncObject.getHash();

    this.emit(EVT_READ_ONLY_SYNC_UPDATE_HASH, ourFullStateHash);
  }

  /**
   * Compares readOnly sync update hash from remote to local's
   * writableSyncObject.
   *
   * If the hash is not verified, it will call this.forceFullSync().
   *
   * @param {string} readOnlySyncUpdateHash
   * @return {boolean}
   */
  verifyReadOnlySyncUpdateHash(readOnlySyncUpdateHash) {
    if (this._writableSyncObject.getHash() === readOnlySyncUpdateHash) {
      return true;
    } else {
      this.forceFullSync();

      return false;
    }
  }

  /**
   * Force full sync operation.
   *
   * @return {void}
   */
  forceFullSync() {
    this.emit(EVT_WRITABLE_FULL_SYNC, this._writableSyncObject.getState());
  }
}

module.exports = BidirectionalSyncObject;
module.exports.EVT_DESTROYED = EVT_DESTROYED;
module.exports.EVT_WRITABLE_PARTIAL_SYNC = EVT_WRITABLE_PARTIAL_SYNC;
module.exports.EVT_WRITABLE_FULL_SYNC = EVT_WRITABLE_FULL_SYNC;
module.exports.EVT_READ_ONLY_SYNC_UPDATE_HASH = EVT_READ_ONLY_SYNC_UPDATE_HASH;
