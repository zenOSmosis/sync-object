const PhantomCore = require("phantom-core");
const { EVT_UPDATED, EVT_DESTROYED } = PhantomCore;
const flatten = require("flat");
const objectPath = require("object-path");
const hash = require("object-hash");
const { addedDiff, updatedDiff } = require("deep-object-diff");
const deepMerge = require("deepmerge");

class SyncObject extends PhantomCore {
  /**
   * Ensures that the supplied state can be serialized.
   *
   * @throws {TypeError} If passed state cannot be validated.
   *
   * @param {Object} state
   * @return void
   */
  static validateState(state) {
    try {
      JSON.stringify(state);
    } catch (err) {
      throw new TypeError("SyncObject cannot contain non-serializable state");
    }

    /**
     * Recursively walks the object checking for invalid properties.
     *
     * @param {Object} obj
     */
    const _rWalk = obj => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const val = obj[key];

          if (typeof val === "function") {
            throw new TypeError(
              "SyncObject cannot contain functions in its state"
            );
          }

          // Arrays are not supported at this time due to them not being easily
          // merge-able.
          //
          // It's easy to add onto an array, sure, but if you remove an element
          // at a particular index it would require a different API call than
          // setState() would deliver.
          //
          // FIXME: Consider re-implementing array support and figure out how
          // to handle them appropriately.
          if (Array.isArray(val)) {
            throw new TypeError(
              "SyncObject cannot contain an array in its state"
            );
          } else if (typeof val === "object") {
            _rWalk(val);
          }
        }
      }
    };

    // Start recursively walking
    _rWalk(state);
  }

  /**
   * IMPORTANT: Every key / value must be serializable.
   *
   * NOTE: Arrays cannot be utilized within in the state because of issues
   * trying to keep arrays in sync after merging.
   *
   * @param {Object} initialState? [default = {}]
   */
  constructor(initialState = {}) {
    SyncObject.validateState(initialState);

    super();

    this._initialState = Object.freeze(initialState);

    this._state = { ...this._initialState };
  }

  /**
   * Updates the state.
   *
   * Default strategy is "merge," meaning that existing properties will be
   * retained.
   *
   * @emits EVT_UPDATED With changed state. IMPORTANT: This is only the changed
   * state, and does not represent values which were the same before updating.
   *
   * @param {Object} updatedState Partial state, if merging; complete state
   * otherwise.
   * @param {boolean} isMerge? [default = true] Non-merging will overwrite the
   * entire state.
   */
  setState(updatedState, isMerge = true) {
    SyncObject.validateState(updatedState);

    if (!isMerge) {
      this._state = updatedState;

      this.emit(EVT_UPDATED, updatedState);
    } else {
      // Do the change detection before changing the state
      const diffedUpdatedState = deepMerge(
        addedDiff(this._state, updatedState),
        updatedDiff(this._state, updatedState)
      );

      // Flatten and walk over the updated state, merging in each value to the
      // class state
      const flatUpdatedState = flatten(updatedState);
      for (const [path, value] of Object.entries(flatUpdatedState)) {
        try {
          objectPath.set(this._state, path, value);
        } catch (err) {
          // Fix issue where parent path might not be an object
          if (
            err instanceof TypeError &&
            err.message.includes("Cannot set property")
          ) {
            const pathParts = path.split(".");
            pathParts.splice(-1, 1);
            const parentPath = pathParts.join(".");

            // Set the parent path to be an object
            objectPath.set(this._state, parentPath, {});

            // Retry the update
            objectPath.set(this._state, path, value);
          } else {
            // Pass original error through
            throw err;
          }
        }
      }

      // Only emit EVT_UPDATED if something has changed
      if (Object.keys(diffedUpdatedState).length) {
        // Emit the actual changed state
        this.emit(EVT_UPDATED, diffedUpdatedState);
      }
    }
  }

  /**
   * Retrieves the current state.
   *
   * @return {Object}
   */
  getState() {
    return this._state;
  }

  /**
   * Retrieves hash which represents the current state.
   *
   * @return {string}
   */
  getHash() {
    return hash(this._state);
  }
}

module.exports = SyncObject;
module.exports.EVT_UPDATED = EVT_UPDATED;
module.exports.EVT_DESTROYED = EVT_DESTROYED;
