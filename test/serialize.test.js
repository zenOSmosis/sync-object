const test = require("tape");
const SyncObject = require("../src");

test("serialization", t => {
  t.throws(() => {
    new SyncObject({
      foo: () => null,
    });
  }, "does not accept functional values in state");

  t.throws(() => {
    const recursive = {};
    recursive.a = recursive;

    new SyncObject(recursive);
  }, "cannot contain recursive objects");

  t.end();
});
