const ram = require('random-access-memory')
const H = require('../../')

// Tests Helpers

function create (key, opts) {
  if (key && !(key instanceof Buffer)) {
    opts = key
    key = null
  }
  return H((opts && opts.corestore) || ram, key, { persist: false, ...opts })
}

module.exports = create
