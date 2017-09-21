// jest remove extensions from require ...
// go to re-add js extension
module.exports = {
  process(src, path) {
    return `
require.extensions = { '.js': function () {} }
${src}`;
  }
};
