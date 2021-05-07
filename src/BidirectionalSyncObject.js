const PhantomCore = require("phantom-core");
const { EVT_DESTROYED } = PhantomCore;
const SyncObject = require("./SyncObject");
const { EVT_UPDATED } = SyncObject;

const EVT_WRITABLE_PARTIAL_SYNC = "writable-sync-updated";
const EVT_WRITABLE_FULL_SYNC = "writable-full-sync";
const EVT_READ_ONLY_SYNC_UPDATE_HASH = "read-only-sync-update-hash";

const debounce = require("lodash.debounce");

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
      // requiresInitialFullSync: true,
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

    // this._requiresInitialFullSync = this._options.requiresInitialFullSync;
    // this._initialFullSyncVerificationHash = null;
    // this._hasInitialFullSync = false;

    // NOTE: This array is not guaranteed to be unique as state can roll back
    // to a previous state before hash verification occurs. An example of a
    // state rolling back is when a user mutes and unmutes without any other
    // state changing.
    // this._unverifiedRemoteSyncHashes = [];

    this.forceFullSync = debounce(
      this.forceFullSync,
      this._options.fullStateDebounceTimeout,
      {
        leading: false,
        trailing: true,
      }
    );

    // IMPORTANT: This debounce value must be lower than the resync threshold
    // or the full state update will run into a continuous loop due to the hash
    // verification timeout
    this.verifyReadOnlySyncUpdateHash = debounce(
      this.verifyReadOnlySyncUpdateHash,
      this._options.writeResyncThreshold / 2,
      {
        leading: false,
        trailing: true,
      }
    );

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

    // const theirFullStateHash = this._readOnlySyncObject.getHash();

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

    if (this._writableSyncObject.getHash() === readOnlySyncUpdateHash) {
      clearTimeout(this._writeSyncVerificationTimeout);

      // Reset unverified hashes
      // this._unverifiedRemoteSyncHashes = [];

      this.log.debug("Remote readOnly in sync with our writable");

      return true;
    } else {
      this.forceFullSync(
        "ReadOnly sync update hash does not match our writable"
      );

      return false;
    }
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
  OLD_verifyReadOnlySyncUpdateHash(readOnlySyncUpdateHash) {
    /*
    if (this._requiresInitialFullSync) {
      // Handle case where _initialFullSyncVerificationHash has not been set
      if (!this._initialFullSyncVerificationHash) {
        // Clear existing verification timeout until initial full sync
        // verification has occurred
        // clearTimeout(this._writeSyncVerificationTimeout);

        this.log.debug(
          "Skipping verification until initial fully sync verification hash has been set"
        );

        // Don't proceed
        return false;
      }

      // Handle case where _initialFullSyncVerificationHash has been set but the
      // initial full sync has not occurred and we have received a different hash
      if (
        !this._hasInitialFullSync &&
        readOnlySyncUpdateHash !== this._initialFullSyncVerificationHash
      ) {
        // Clear existing verification timeout until initial full sync verification has occurred
        // clearTimeout(this._writeSyncVerificationTimeout);

        this.log.debug(
          "Skipping verification until received full state verification hash"
        );

        // Don't proceed
        return false;
      } else if (
        readOnlySyncUpdateHash === this._initialFullSyncVerificationHash
      ) {
        this._hasInitialFullSync = true;
      }
    }
    */
    // If the received readOnlySyncUpdateHash matches a known, but unverified hash
    /*
    if (this._unverifiedRemoteSyncHashes.includes(readOnlySyncUpdateHash)) {
      const lenUnverifiedHashes = this._unverifiedRemoteSyncHashes.length;

      // If the readOnlySyncUpdateHash does not equal the last unverified hash
      if (
        this._unverifiedRemoteSyncHashes[lenUnverifiedHashes - 1] !==
        readOnlySyncUpdateHash
      ) {
        // Remove the current hash from the unverified hashes
        this._unverifiedRemoteSyncHashes = this._unverifiedRemoteSyncHashes.filter(
          hash => hash !== readOnlySyncUpdateHash
        );

        // NOTE: The concurrent, subsequent update should trigger this method
        // to run again once the verification hash has been received, or else,
        // the writeResyncThreshold timeout will trigger a full state sync

        this.log.debug("Subsequent update is in progress");

        return false;
      } else {
      }
    } else {
      this.forceFullSync(() => {
        this.log.warn("Unknown readOnlySyncUpdateHash; performing full sync");
      });

      return false;
    }
    */
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

    // const fullState = this._writableSyncObject.getState();
    // const fullStateHash = this._writableSyncObject.getHash();

    /*
    if (
      this._requiresInitialFullSync &&
      !this._initialFullSyncVerificationHash
    ) {
      this._initialFullSyncVerificationHash = fullStateHash;
    }
    */

    // Add current writable hash to unverified hashes
    // this._unverifiedRemoteSyncHashes.push(fullStateHash);

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
   * @param {Object} updatedState NOTE: This state will typically be the changed
   * state, and not the full state of the calling SyncObject.
   * @return void
   */
  _writableDidPartiallyUpdate(updatedState) {
    /*
    if (this._requiresInitialFullSync && !this._hasInitialFullSync) {
      this.log.debug("Skipping partial update until initial full sync occurs");

      return;
    }
    */

    clearTimeout(this._writeSyncVerificationTimeout);

    // const fullStateHash = this._writableSyncObject.getHash();

    // Add current writable hash to unverified hashes
    // this._unverifiedRemoteSyncHashes.push(fullStateHash);

    // Perform sync
    // this.emit(EVT_WRITABLE_PARTIAL_SYNC, updatedState);
    this._sendUpdateWriteEvent(updatedState);

    this._writeSyncVerificationTimeout = setTimeout(() => {
      this.forceFullSync(
        "Hash verification check did not occur in a timely manner after partial update"
      );
    }, this._options.writeResyncThreshold);
  }

  /**
   * Sends the given updated state to the other peer.
   *
   * TODO: Debounce this, merging updatedStates together.
   *
   * @param {Object} updatedState
   * @return {void}
   */
  _sendUpdateWriteEvent(updatedState) {
    if (!updatedState) {
      throw new Error("state must be set");
    }

    this.log.debug("Sending updated state", updatedState);

    this.emit(EVT_WRITABLE_PARTIAL_SYNC, updatedState);
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
