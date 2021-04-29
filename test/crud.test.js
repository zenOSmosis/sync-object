const test = require("tape");
const SyncObject = require("../src");
const { EVT_UPDATED } = SyncObject;

test("instantiates without any parameters", t => {
  t.ok(new SyncObject());

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
