const PhantomBase = require("phantom-base");
const { EVT_UPDATED, EVT_DESTROYED } = PhantomBase;
const flatten = require("flat");
const objectPath = require("object-path");
const hash = require("object-hash");

class SyncObject extends PhantomBase {
  /**
   * Ensures that the supplied state can be serialized.
   *
   * @param {Object} state
   * @return void
   */
  static validateState(state) {
    try {
      JSON.stringify(state);
    } catch (err) {
      throw new Error("SyncObject cannot contain non-serializable state");
    }

    const walk = obj => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const val = obj[key];

          if (typeof val === "function") {
            throw new Error("SyncObject cannot contain functions in its state");
          }

          if (Array.isArray(val)) {
            throw new Error("SyncObject cannot contain an array in its state");
          } else if (typeof val === "object") {
            walk(val);
          }
        }
      }
    };

    walk(state);
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
   * @param {Object} updatedState Partial state, if merging; complete state
   * otherwise.
   * @param {boolean} isMerge? [default = true] Non-merging will overwrite the
   * entire state.
   */
  setState(updatedState, isMerge = true) {
    SyncObject.validateState(updatedState);

    if (!isMerge) {
      this._state = updatedState;
    } else {
      const flatUpdatedState = flatten(updatedState);

      for (const [path, value] of Object.entries(flatUpdatedState)) {
        objectPath.set(this._state, path, value);
      }
    }

    this.emit(EVT_UPDATED, updatedState);
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
