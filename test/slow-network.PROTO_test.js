const test = require("tape");
const SyncObject = require("../src");
const {
  BidirectionalSyncObject,
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = SyncObject;

class SlowBidirectionalSyncObject extends BidirectionalSyncObject {
  /**
   * Simulate network latency by delaying the event emitter
   */
  async emit(...args) {
    await new Promise(resolve =>
      setTimeout(() => {
        super.emit(...args);

        resolve();
      }, 3000)
    );
  }
}

test("syncs over slow network", async t => {
  t.plan(4);

  const peerAWritableSyncObject = new SyncObject({ test: 234, foo: 456 });
  const peerAReadOnlySyncObject = new SyncObject();

  const peerBWritableSyncObject = new SyncObject();
  const peerBReadOnlySyncObject = new SyncObject({ test: 456, foo: 123 });

  const peerA = new SlowBidirectionalSyncObject(
    peerAWritableSyncObject,
    peerAReadOnlySyncObject
  );

  const peerB = new SlowBidirectionalSyncObject(
    peerBWritableSyncObject,
    peerBReadOnlySyncObject
  );

  // Set peer A writable state and send it to peer b
  await Promise.all([
    new Promise(resolve => {
      peerA.once(EVT_WRITABLE_PARTIAL_SYNC, async state => {
        // peerB: Receive peerA state
        await Promise.all([
          new Promise(resolve => {
            peerB.once(
              EVT_READ_ONLY_SYNC_UPDATE_HASH,
              async readOnlySyncUpdateHash => {
                t.ok(
                  true,
                  "EVT_READ_ONLY_SYNC_UPDATE_HASH is emit after receiveReadyOnlyState is called"
                );

                await (async () => {
                  let isReadOnlyHashVerified = null;

                  await Promise.all([
                    new Promise(resolve => {
                      peerA.once(EVT_WRITABLE_FULL_SYNC, async fullState => {
                        t.notOk(
                          isReadOnlyHashVerified,
                          "EVT_WRITABLE_FULL_SYNC is emit after not verifying read-only sync update hash"
                        );

                        await Promise.all([
                          new Promise(resolve =>
                            peerB.once(
                              EVT_READ_ONLY_SYNC_UPDATE_HASH,
                              updateHash => {
                                t.ok(
                                  peerA.verifyReadOnlySyncUpdateHash(
                                    updateHash
                                  ),
                                  `peerBReadOnlySyncObject full state hash matches peerAWritableSyncObject's`
                                );

                                resolve();
                              }
                            )
                          ),

                          peerB.receiveReadOnlyState(fullState, false),
                        ]);

                        resolve();
                      });
                    }),
                    (isReadOnlyHashVerified = peerA.verifyReadOnlySyncUpdateHash(
                      readOnlySyncUpdateHash
                    )),
                  ]);
                })();

                resolve();
              }
            );
          }),

          peerB.receiveReadOnlyState(state),
        ]);

        resolve();
      });
    }),

    peerAWritableSyncObject.setState({ test: 123 }),
  ]);

  t.deepEqual(
    peerAWritableSyncObject.getState(),
    peerBReadOnlySyncObject.getState(),
    "peerB's readOnly state matches peerA's writeable"
  );

  t.end();
});
