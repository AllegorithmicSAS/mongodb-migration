const _ = require('lodash');
const requireDir = require('require-dir');

const MIGRATION_ID_RE = /^(\d{4})-/;

/**
 * @arg {mongodb.Db} db
 */
exports.autoMigrate = async function(db, absoluteMigrationsDir) {
  const migrations = requireDir(absoluteMigrationsDir);
  const migrationNames = _.sortBy(_.keys(migrations));

  const col = db.collection('migrations');

  const currentVersion = _.get(
    await col.findOne({ _id: 'default' }),
    'currentVersion',
    '0000'
  );

  console.log(`Database schema is at version ${currentVersion}`);

  const migrationsToApply = _.filter(migrationNames, name => {
    const res = MIGRATION_ID_RE.exec(name);

    // validate migrations names
    if (!res) {
      console.error(`invalid migration file found: ${name}.js, skipping`);
      console.error(`expected format : 1234-xxxxxxxx.js`);
      return false;
    }

    return res[1] > currentVersion;
  });

  if (_.isEmpty(migrationsToApply)) return;

  // lock database in case many services try to migrate in parallel
  const lockedForThisService = _.get(
    await col.findOneAndUpdate(
      { _id: 'lock' },
      { $set: { _id: 'lock', locked: true } },
      { upsert: true }
    ),
    'value.locked',
    false
  );

  if (lockedForThisService) return;

  let error = null;
  try {
    console.log(`${migrationsToApply.length} migration(s) to apply...`);

    for (const name of migrationsToApply) {
      console.log(` - applying migration ${name}`);
      const newVersion = MIGRATION_ID_RE.exec(name)[1];
      await migrations[name].up(db);
      await col.findOneAndUpdate(
        { _id: 'default' },
        { $set: { _id: 'default', currentVersion: newVersion } },
        { upsert: true }
      );
      console.log(` - done applying migration ${name}`);
    }
    console.log(`done applying all migrations`);
  } catch (err) {
    error = err;
    console.log('Migration failed: ' + err);
  }

  //unlock database
  await col.updateOne({ _id: 'lock' }, { $set: { locked: false } });

  if (error) {
    throw error;
  }
};
