const test = require("tape");
const SyncObject = require("../src");

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

  t.equals(hash1, sync.getHash(), "regenerates same hash");

  sync.setState({
    foo: {
      test: 456,
    },
  });

  const hash2 = sync.getHash();

  t.notEquals(hash1, hash2);

  t.end();
});
