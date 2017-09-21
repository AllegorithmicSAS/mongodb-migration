exports.up = async function(db) {
  if (db.throw) {
    throw Error('0001-test-failed');
  }

  db.migration1 = true;
};
