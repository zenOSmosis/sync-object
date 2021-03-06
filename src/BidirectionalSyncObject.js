const PhantomCore = require("phantom-core");
const { EVT_DESTROYED } = PhantomCore;
const SyncObject = require("./SyncObject");
const { EVT_UPDATED } = SyncObject;

const debounce = require("debounce");

const EVT_WRITABLE_PARTIAL_SYNC = "writable-sync-updated";
const EVT_WRITABLE_FULL_SYNC = "writable-full-sync";
const EVT_READ_ONLY_SYNC_UPDATE_HASH = "read-only-sync-update-hash";

/**
 * The number of milliseconds the writable sync should wait for a hash
 * verification from the read-only peer.
 */
const DEFAULT_WRITE_RESYNC_THRESHOLD = 8000;

/**
 * The number of milliseconds the writable sync should debounce when doing
 * rapid syncs in succession, in order to avoid sending full state multiple
 * times.
 *
 * Note that most syncs after the initial sync will skip this debounce
 * entirely, as the updates will be partial state updates, instead of full.
 */
const DEFAULT_FULL_STATE_DEBOUNCE_TIMEOUT = 1000;

/**
 * Provides P2P access for SyncObject modules, using two SyncObjects, where
 * one represents the local (writable) peer and the other represents the
 * "remote" (readOnly) peer.
 */
class BidirectionalSyncObject extends PhantomCore {
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
  constructor(
    writableSyncObject = null,
    readOnlySyncObject = null,
    options = { logLevel: "debug" /* TODO: Remove */ }
  ) {
    const DEFAULT_OPTIONS = {
      writeResyncThreshold: DEFAULT_WRITE_RESYNC_THRESHOLD,
      fullStateDebounceTimeout: DEFAULT_FULL_STATE_DEBOUNCE_TIMEOUT,
    };

    if (writableSyncObject && readOnlySyncObject) {
      if (writableSyncObject.getIsSameInstance(readOnlySyncObject)) {
        throw new Error(
          "ReadOnly and writable sync objects cannot be the same instance"
        );
      }
    }

    super({ ...DEFAULT_OPTIONS, ...options });

    // Our state
    this._writableSyncObject = writableSyncObject || this._makeSyncObject();

    // Their state
    this._readOnlySyncObject = readOnlySyncObject || this._makeSyncObject();

    this._writableDidPartiallyUpdate = this._writableDidPartiallyUpdate.bind(
      this
    );

    this._writableSyncObject.on(EVT_UPDATED, this._writableDidPartiallyUpdate);

    this._writeSyncVerificationTimeout = null;

    this.forceFullSync = debounce(
      this.forceFullSync,
      this._options.fullStateDebounceTimeout,
      // Use trailing edge
      false
    );
    this.registerCleanupHandler(() => {
      this.forceFullSync.clear();
    });

    // IMPORTANT: This debounce value must be lower than the resync threshold
    // or the full state update will run into a continuous loop due to the hash
    // verification timeout
    this.verifyReadOnlySyncUpdateHash = debounce(
      this.verifyReadOnlySyncUpdateHash,
      this._options.writeResyncThreshold / 2,
      // Use trailing edge
      false
    );
    this.registerCleanupHandler(() => {
      this.verifyReadOnlySyncUpdateHash.clear();
    });

    this._readOnlySyncHashVerifierTimeout = null;
  }

  /**
   * @return {Promise<void>}
   */
  async destroy() {
    clearTimeout(this._writeSyncVerificationTimeout);

    this._writableSyncObject.off(EVT_UPDATED, this._writableDidPartiallyUpdate);

    await super.destroy();
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
    this.registerCleanupHandler(() => syncObject.destroy());

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
   * This should be called when there is state to update the
   * readOnlySyncObject.
   *
   * IMPORTANT: This should be utilized instead of calling the
   * readOnlySyncObject.setUpdate() method directly, as the sync won't update
   * properly when doing so.
   *
   * @param {Object} state Partial, or full state, depending on isMerge value.
   * @param {boolean} isMerge? [optional; default = true] If true, state is a
   * partial state. If false, the entire local state will be overwritten.
   * @return void
   */
  receiveReadOnlyState(state, isMerge = true) {
    this.log.debug(
      `Receiving readOnly, ${isMerge ? "partial" : "full"} state`,
      state
    );

    // Update our readOnly state with what was sent
    this._readOnlySyncObject.setState(state, isMerge);

    this.log.debug(
      `Updated readOnly to state hash: ${this._readOnlySyncObject.getHash()}`
    );

    // This should be compared against the other peer's writable SyncObject
    // full state hash in order to determine if the states are in sync
    // (EVT_READ_ONLY_SYNC_UPDATE_HASH, theirFullStateHash);
    this._sendReadOnlyHash();
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
    this.log.debug(
      `Verifying readOnlySyncUpdateHash: ${readOnlySyncUpdateHash}`
    );

    const writableHash = this._writableSyncObject.getHash();

    if (writableHash === readOnlySyncUpdateHash) {
      clearTimeout(this._writeSyncVerificationTimeout);

      this.log.debug("Remote readOnly in sync with our writable");

      return true;
    } else {
      this.forceFullSync(
        `ReadOnly sync update hash does not match our writable (ours: "${writableHash}" / theirs: "${readOnlySyncUpdateHash}")`
      );

      return false;
    }
  }

  /**
   * Force full sync operation.
   *
   * NOTE: This function is debounced by this._options.fullStateDebounceTimeout
   * and an optional cb parameter is supplied for additional code to run after
   * the function executes.
   *
   * @param {string} reason?
   * @return {void}
   */
  forceFullSync(reason = null) {
    clearTimeout(this._writeSyncVerificationTimeout);

    this.log.warn(
      "Performing full sync" + (reason ? ` due to: ${reason}` : "")
    );

    // this._sendWriteEvent(EVT_WRITABLE_FULL_SYNC, fullState);
    this._sendFullWriteEvent();

    this._writeSyncVerificationTimeout = setTimeout(() => {
      this.forceFullSync(
        "Hash verification check did not occur in a timely manner after previous full sync"
      );
    }, this._options.writeResyncThreshold);
  }

  /**
   * Called when our own writable state has updated.
   *
   * Triggers network EVT_WRITABLE_PARTIAL_SYNC from local writable
   * SyncObject when it has been updated.
   *
   * This is handled via the writeableSyncObject.
   *
   * @param {Object} partialNextState NOTE: This state will typically be the changed
   * state, and not the full state of the calling SyncObject.
   * @return void
   */
  _writableDidPartiallyUpdate(partialNextState) {
    clearTimeout(this._writeSyncVerificationTimeout);

    this._sendUpdateWriteEvent(partialNextState);

    this._writeSyncVerificationTimeout = setTimeout(() => {
      this.forceFullSync(
        "Hash verification check did not occur in a timely manner after partial update"
      );
    }, this._options.writeResyncThreshold);
  }

  /**
   * Sends the given updated state to the other peer.
   *
   * TODO: Debounce this, merging partialNextStates together.
   *
   * @param {Object} partialNextState
   * @return {void}
   */
  _sendUpdateWriteEvent(partialNextState) {
    if (!partialNextState) {
      throw new Error("state must be set");
    }

    this.log.debug("Sending updated state", partialNextState);

    this.emit(EVT_WRITABLE_PARTIAL_SYNC, partialNextState);
  }

  /**
   * Gathers our writeable full state and transmits it to the other peer (full
   * sync).
   *
   * @return {void}
   */
  _sendFullWriteEvent() {
    this.log.debug("Sending full state");

    this.emit(EVT_WRITABLE_FULL_SYNC, this._writableSyncObject.getState());
  }

  /**
   * Gathers our readOnly hash value and transmits it to the other peer.
   *
   * @return {void}
   */
  _sendReadOnlyHash() {
    clearTimeout(this._readOnlySyncHashVerifierTimeout);

    const readOnlySyncUpdateHash = this._readOnlySyncObject.getHash();

    this.log.debug(`Sending readOnlyUpdateHash: ${readOnlySyncUpdateHash}`);

    this.emit(EVT_READ_ONLY_SYNC_UPDATE_HASH, readOnlySyncUpdateHash);

    // Send post update verification hash (double-assurance we're running the
    // latest hash in order to prevent stale state)
    this._readOnlySyncHashVerifierTimeout = setTimeout(() => {
      const readOnlySyncVerificationHash = this._readOnlySyncObject.getHash();

      this.log.debug(
        `Sending readOnly post-update verification hash: ${readOnlySyncVerificationHash}`
      );
      this.emit(EVT_READ_ONLY_SYNC_UPDATE_HASH, readOnlySyncVerificationHash);
    }, this._options.writeResyncThreshold);
  }
}

module.exports = BidirectionalSyncObject;
module.exports.EVT_DESTROYED = EVT_DESTROYED;
module.exports.EVT_WRITABLE_PARTIAL_SYNC = EVT_WRITABLE_PARTIAL_SYNC;
module.exports.EVT_WRITABLE_FULL_SYNC = EVT_WRITABLE_FULL_SYNC;
module.exports.EVT_READ_ONLY_SYNC_UPDATE_HASH = EVT_READ_ONLY_SYNC_UPDATE_HASH;
