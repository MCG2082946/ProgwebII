const { randomInt } = require('node:crypto');
module.exports = function newFolio() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'LIB-' + Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
};
