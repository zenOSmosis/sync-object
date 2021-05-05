const test = require("tape");
const SyncObject = require("../src");
const { EVT_UPDATED } = SyncObject;

test("instantiates without any parameters", async t => {
  t.plan(2);

  const sync = new SyncObject();

  t.ok(sync, "instantiates");

  t.ok(await sync.destroy().then(() => true), "destroys");

  t.end();
});

test("handles getState", t => {
  const sync = new SyncObject({
    foo: {
      bar: 123,
    },
  });

  t.deepEqual(sync.getState(), {
    foo: {
      bar: 123,
    },
  });

  t.end();
});

test("handles merging setState", t => {
  const sync = new SyncObject({
    foo: {
      bar: 123,
      3: 4,
    },
  });

  sync.setState({
    foo: {
      bar: 456,
    },
  });

  t.deepEqual(sync.getState(), {
    foo: {
      bar: 456,
      3: 4,
    },
  });

  sync.setState({
    foo: {
      3: null,
    },
  });

  t.deepEqual(
    sync.getState(),
    {
      foo: {
        bar: 456,
        3: null,
      },
    },
    "sets a value to null"
  );

  sync.setState({
    foo: undefined,
  });

  t.deepEqual(
    sync.getState(),
    {
      foo: undefined,
    },
    "sets a multi-level object to undefined"
  );

  t.end();
});

test("handles non-merging setState", t => {
  const sync = new SyncObject({
    foo: {
      bar: 123,
      3: 4,
    },
  });

  sync.setState(
    {
      foo: "bar",
    },
    false
  );

  t.deepEqual(sync.getState(), {
    foo: "bar",
  });

  t.end();
});

test("handles hashing", t => {
  const sync = new SyncObject({
    test: 123,
  });

  const hash1 = sync.getHash();

  t.equals(hash1, sync.getHash(), "regenerates same hash on subsequent runs");

  sync.setState({
    foo: {
      test: 456,
    },
  });

  const hash2 = sync.getHash();

  t.notEquals(hash1, hash2, "generates new hash on new updates");

  t.end();
});

test("handles diff state updates", async t => {
  t.plan(4);

  const sync = new SyncObject({
    test: 123,
    other: 456,
  });

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, updatedState => {
        t.deepEquals(
          updatedState,
          { other: 101112 },
          "diffs changed state value with same type"
        );

        resolve();
      })
    ),

    sync.setState({ test: 123, other: 101112 }),
  ]);

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, updatedState => {
        t.deepEquals(
          updatedState,
          { test: "abcde", foo: "bar" },
          "diffs changes state value with different type"
        );

        resolve();
      })
    ),

    sync.setState({ test: "abcde", foo: "bar", other: 101112 }),
  ]);

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, updatedState => {
        t.deepEquals(
          updatedState,
          { other: undefined },
          "diffs undefined state"
        );

        resolve();
      })
    ),

    sync.setState({ test: "abcde", foo: "bar", other: undefined }),
  ]);

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, updatedState => {
        t.deepEquals(updatedState, { foo: null }, "diffs null state");

        resolve();
      })
    ),

    sync.setState({ test: "abcde", foo: null, other: undefined }),
  ]);

  t.end();
});

test("handles post-null recovery", async t => {
  const sync = new SyncObject({
    peers: {
      ["abcde"]: {
        name: "Peer A",
      },
      ["fghij"]: {
        name: "Peer B",
      },
    },
  });

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, () => {
        t.deepEquals(sync.getState(), {
          peers: {
            ["abcde"]: {
              name: "Peer A",
            },
            ["fghij"]: null,
          },
        });

        resolve();
      })
    ),

    sync.setState({
      peers: {
        ["fghij"]: null,
      },
    }),
  ]);

  await Promise.all([
    new Promise(resolve =>
      sync.once(EVT_UPDATED, () => {
        t.deepEquals(sync.getState(), {
          peers: {
            ["abcde"]: {
              name: "Peer A",
            },
            ["fghij"]: {
              name: "Peer B",
            },
          },
        });

        resolve();
      })
    ),

    sync.setState({
      peers: {
        ["fghij"]: {
          name: "Peer B",
        },
      },
    }),
  ]);

  t.end();
});

test("handles EVT_UPDATED diff", async t => {
  t.plan(4);

  const sync = new SyncObject({
    peers: {
      ["abcde"]: {
        media: {
          ["media1"]: {
            kinds: "audio",
          },
        },
      },
    },
  });

  await Promise.all([
    new Promise(resolve => {
      sync.once(EVT_UPDATED, changedState => {
        t.deepEquals(
          changedState,
          {
            peers: { abcde: { media: { media2: { kinds: "audio,video" } } } },
          },
          "handles basic diffing"
        );

        resolve();
      });
    }),

    sync.setState({
      peers: {
        ["abcde"]: {
          media: {
            ["media1"]: {
              kinds: "audio",
            },
            ["media2"]: {
              kinds: "audio,video",
            },
          },
        },
      },
    }),
  ]);

  await Promise.all([
    new Promise(resolve => {
      sync.once(EVT_UPDATED, changedState => {
        t.deepEquals(
          changedState,
          {
            peers: { abcde: { avatarURL: "some-url" } },
          },
          "handles subsequent diffing with separate child object"
        );

        resolve();
      });
    }),

    sync.setState({
      peers: {
        ["abcde"]: {
          avatarURL: "some-url",
        },
      },
    }),
  ]);

  await Promise.all([
    Promise.race([
      new Promise(() => {
        sync.once(EVT_UPDATED, () => {
          throw new Error("Should not get here");
        });
      }),

      new Promise(resolve =>
        setTimeout(() => {
          t.ok(
            true,
            "does not trigger EVT_UPDATED if there is no changed state"
          );

          resolve();
        }, 1000)
      ),
    ]),

    sync.setState({
      peers: {
        ["abcde"]: {
          media: {
            ["media1"]: {
              kinds: "audio",
            },
          },
        },
      },
    }),
  ]);

  t.deepEquals(
    sync.getState(),
    {
      peers: {
        abcde: {
          media: {
            media1: { kinds: "audio" },
            media2: { kinds: "audio,video" },
          },
          avatarURL: "some-url",
        },
      },
    },
    "merges successfully after multiple EVT_UPDATED diff checks"
  );

  t.end();
});

test("does not accept non-plain object states", t => {
  t.plan(2);

  t.throws(() => {
    new SyncObject({
      sync: new SyncObject(),
    });
  }, "rejects constructed classes as initial state");

  const sync = new SyncObject();

  t.throws(() => {
    sync.setState({ test: new SyncObject() });
  }, "rejects constructed classes as updated state");

  t.end();
});
