const { autoMigrate } = require('../index');
const path = require('path');

describe('Test autoMigrate', () => {
  beforeEach(() => {
    migrationCollection = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn()
    };
    this.collection = migrationCollection;

    this.dummydb = {
      collection: function(name) {
        return migrationCollection;
      }
    };
  });
  test('expect to run migrations', async () => {
    await autoMigrate(this.dummydb, './test/migrations/');

    expect(this.collection.findOne).toBeCalledWith({ _id: 'default' });
    expect(this.collection.findOneAndUpdate).toBeCalledWith(
      { _id: 'lock' },
      { _id: 'lock', locked: true },
      { upsert: true }
    );
    expect(this.collection.findOneAndUpdate).toBeCalledWith(
      { _id: 'default' },
      { _id: 'default', currentVersion: '0001' },
      { upsert: true }
    );
    expect(this.collection.updateOne).toBeCalledWith(
      { _id: 'lock' },
      { _id: 'lock', locked: false }
    );
    expect(this.dummydb.migration1).toBeTruthy();
  });

  test('unlock if one migration failed', async () => {
    this.dummydb.throw = true;
    try {
      await autoMigrate(this.dummydb, './test/migrations/');
    } catch (err) {
      expect(err).toEqual(Error('0001-test-failed'));
    }
    expect(this.collection.findOne).toBeCalledWith({ _id: 'default' });
    expect(this.collection.findOneAndUpdate).toBeCalledWith(
      { _id: 'lock' },
      { _id: 'lock', locked: true },
      { upsert: true }
    );
    expect(this.collection.updateOne).toBeCalledWith(
      { _id: 'lock' },
      { _id: 'lock', locked: false }
    );
    expect(this.dummydb.migration1).toBeFalsy();
  });
});
