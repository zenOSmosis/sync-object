const test = require("tape-async");
const { getClassName } = require("phantom-core");
const SyncObject = require("../src");
const {
  BidirectionalSyncObject,
  EVT_WRITABLE_PARTIAL_SYNC,
  EVT_WRITABLE_FULL_SYNC,
  EVT_READ_ONLY_SYNC_UPDATE_HASH,
} = SyncObject;

test("instantiates without any parameters", async t => {
  t.plan(8);

  const syncChannel = new BidirectionalSyncObject();
  const syncObjectClassName = getClassName(SyncObject);

  // Auto-instantiated
  const readOnlySyncObject = syncChannel.getReadOnlySyncObject();
  const writeableSyncObject = syncChannel.getWritableSyncObject();

  t.equals(
    readOnlySyncObject.getClassName(),
    syncObjectClassName,
    "creates default readOnly SyncObject"
  );

  t.equals(
    writeableSyncObject.getClassName(),
    syncObjectClassName,
    "creates default writable SyncObject"
  );

  t.notOk(
    syncChannel
      .getReadOnlySyncObject()
      .getIsSameInstance(syncChannel.getWritableSyncObject()),
    "readOnly and writable are not the same instance"
  );

  t.ok(
    !readOnlySyncObject.getIsDestroyed(),
    "auto-instantiated readOnlySyncObject is not destructed before syncChannel is destructed"
  );
  t.ok(
    !writeableSyncObject.getIsDestroyed(),
    "auto-instantiated writeableSyncObject is not destructed before syncChannel is destructed"
  );

  t.ok(await syncChannel.destroy().then(() => true), "destroys");

  t.ok(
    readOnlySyncObject.getIsDestroyed(),
    "auto-instantiated readOnlySyncObject is destructed when syncChannel is destructed"
  );
  t.ok(
    writeableSyncObject.getIsDestroyed(),
    "auto-instantiated writeableSyncObject is destructed when syncChannel is destructed"
  );

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

  const syncChannel = new BidirectionalSyncObject(writableSyncObject, null);

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

  syncChannel.registerShutdownHandler(() => writableSyncObject.destroy());

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
    peerAReadOnlySyncObject
  );

  peerA.registerShutdownHandler(() =>
    Promise.all([
      peerAWritableSyncObject.destroy(),
      peerAReadOnlySyncObject.destroy(),
    ])
  );

  const peerB = new BidirectionalSyncObject(
    peerBWritableSyncObject,
    peerBReadOnlySyncObject
  );

  peerB.registerShutdownHandler(() =>
    Promise.all([
      peerBWritableSyncObject.destroy(),
      peerBReadOnlySyncObject.destroy(),
    ])
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
