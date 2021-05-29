const test = require("tape-async");
const SyncObject = require("../src");
const {
  BidirectionalSyncObject,
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = SyncObject;

test("instantiates without any parameters", async t => {
  t.plan(4);

  const syncChannel = new BidirectionalSyncObject();
  const syncObject = new SyncObject();

  t.equals(
    syncChannel.getReadOnlySyncObject().getClassName(),
    syncObject.getClassName(),
    "creates default readOnly SyncObject"
  );

  t.equals(
    syncChannel.getWritableSyncObject().getClassName(),
    syncObject.getClassName(),
    "creates default writable SyncObject"
  );

  t.notOk(
    syncChannel
      .getReadOnlySyncObject()
      .getIsSameInstance(syncChannel.getWritableSyncObject()),
    "readOnly and writable are not the same instance"
  );

  t.ok(await syncChannel.destroy().then(() => true), "destroys");

  t.end();
});

test("ensures readOnly and writable sync objects cannot be the same instance", t => {
  const syncObject = new SyncObject();

  t.throws(() => {
    new BidirectionalSyncObject(syncObject, syncObject);
  }, "readOnly and writable sync objects cannot be the same instance");

  t.end();
});

test("ensures EVT_WRITABLE_PARTIAL_SYNC is emit once writable updates", async t => {
  t.plan(1);

  const writableSyncObject = new SyncObject();

  const syncChannel = new BidirectionalSyncObject(writableSyncObject, null, {
    // requiresInitialFullSync: false,
  });

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

  syncChannel.destroy();

  t.end();
});

test("syncs non-synchronized states", async t => {
  t.plan(5);

  const peerAWritableSyncObject = new SyncObject({ test: 234, foo: 456 });
  const peerAReadOnlySyncObject = new SyncObject();

  const peerBWritableSyncObject = new SyncObject();
  const peerBReadOnlySyncObject = new SyncObject({ test: 456, foo: 123 });

  const peerA = new BidirectionalSyncObject(
    peerAWritableSyncObject,
    peerAReadOnlySyncObject,
    {
      // requiresInitialFullSync: false,
    }
  );

  const peerB = new BidirectionalSyncObject(
    peerBWritableSyncObject,
    peerBReadOnlySyncObject,
    {
      // requiresInitialFullSync: false,
    }
  );

  // Set peerA writable state and send it to peerB
  await Promise.all([
    new Promise(resolve => {
      // peerA will emit partial writable sync once it has state to update
      peerA.once(EVT_WRITABLE_PARTIAL_SYNC, async state => {
        await Promise.all([
          new Promise(resolve => {
            // peerB receives peerA's state by passing it to peerB.receiveReadOnlyState(state)
            // In a real-life situation this would be facilitated through the network
            // EVT_READ_ONLY_SYNC_UPDATE_HASH is emit from peerB once it processes the received state
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
                              async updateHash => {
                                t.equals(
                                  peerA.getWritableSyncObject().getHash(),
                                  updateHash,
                                  `peerA writable hash matches update hash`
                                );

                                t.equals(
                                  peerB.getReadOnlySyncObject().getHash(),
                                  updateHash,
                                  `peerB readOnly hash matches update hash`
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

  peerA.destroy();
  peerB.destroy();

  t.end();
});
