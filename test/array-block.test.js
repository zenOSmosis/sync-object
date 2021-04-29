const test = require("tape");
const SyncObject = require("../src");

test("does not handle arrays", t => {
  t.throws(() => {
    new SyncObject({
      items: ["shoes", "shorts", "shirts"],
    });
  }, "blocks arrays within root-level object");

  t.throws(() => {
    new SyncObject({
      foo: {
        bar: {
          items: ["shoes", "shorts", "shirts"],
        },
      },
    });
  }, "blocks arrays within deep-level objects");

  const sync = new SyncObject();

  t.throws(() => {
    sync.setState({
      foo: {
        bar: {
          items: ["shoes", "shorts", "shirts"],
        },
      },
    });
  }, "blocks state update with deep-level array");

  t.end();
});
