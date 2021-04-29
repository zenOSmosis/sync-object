const test = require("tape-async");
const SyncObject = require("../src");
const {
  BidirectionalSyncObject,
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = SyncObject;

test("instantiates without any parameters", t => {
  const syncChannel = new BidirectionalSyncObject();
  const syncObject = new SyncObject();

  t.equals(
    syncChannel.getReadOnlySyncObject().getClassName(),
    syncObject.getClassName()
  );

  t.equals(
    syncChannel.getWritableSyncObject().getClassName(),
    syncObject.getClassName()
  );

  t.notOk(
    syncChannel
      .getReadOnlySyncObject()
      .getIsSameInstance(syncChannel.getWritableSyncObject()),
    "readOnly and writable are not the same object"
  );

  syncChannel.destroy();
  syncObject.destroy();

  t.end();
});

test("ensures readOnly and writable sync objects cannot be the same instance", t => {
  const syncObject = new SyncObject();

  t.throws(() => {
    new BidirectionalSyncObject(syncObject, syncObject);
  }, "readOnly and writable sync objects cannot be the same instance");

  syncObject.destroy();

  t.end();
});

test("ensures EVT_WRITABLE_PARTIAL_SYNC is emit once writable updates", async t => {
  t.plan(1);

  const writableSyncObject = new SyncObject();

  const syncChannel = new BidirectionalSyncObject(writableSyncObject);

  await Promise.all([
    new Promise(resolve => {
      syncChannel.once(EVT_WRITABLE_PARTIAL_SYNC, () => {
        t.ok(
          true,
          "EVT_WRITABLE_PARTIAL_SYNC is emit after writableSyncObject state is updated"
        );

        resolve();
      });
    }),

    writableSyncObject.setState({ foo: "bar" }),
  ]);

  writableSyncObject.destroy();
  syncChannel.destroy();

  t.end();
});

test("syncs non-synchronized states", async t => {
  t.plan(4);

  const peerAWritableSyncObject = new SyncObject({ test: 234, foo: 456 });
  const peerAReadOnlySyncObject = new SyncObject();

  const peerBWritableSyncObject = new SyncObject();
  const peerBReadOnlySyncObject = new SyncObject({ test: 456, foo: 123 });

  const peerA = new BidirectionalSyncObject(
    peerAWritableSyncObject,
    peerAReadOnlySyncObject
  );

  const peerB = new BidirectionalSyncObject(
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
