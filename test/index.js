const proxyquire = require('proxyquire')
const ram = require('random-access-memory')

const hyperdrive = require('..')
const callbackMethods = require('../callback-methods')

function create (key, opts) {
  if (key && !(key instanceof Buffer)) {
    opts = key
    key = null
  }

  return toCallback(hyperdrive((opts && opts.corestore) || ram, key, { persist: false, ...opts }))
}

function toCallback (feed) {
  return new Proxy(feed, {
    get (target, propKey) {
      const value = Reflect.get(target, propKey)
      if (callbackMethods.includes(propKey)) {
        return (...args) => {
          if (typeof args[args.length - 1] === 'function') {
            const cb = args.pop()
            return value(...args).then(result => {
              // These functions returns multiple arguments
              if (['read', 'write', 'stat'].includes(propKey)) {
                return cb(null, ...result)
              }
              return cb(null, result)
            }).catch(err => {
              cb(err)
            })
          }
          return value(...args)
        }
      }
      return value
    }
  })
}

const tests = [
  'basic',
  'checkout',
  'creation',
  'deletion',
  'diff',
  'fd',
  'fuzzing',
  'stat',
  'storage',
  'watch',
  'mount',
  'symlink',
  'download'
]

// We convert the promise style into callbacks (again) to test against the
// original hyperdrive test code, if the promises are ok, the callbacks should work fine.
tests.forEach(test => proxyquire(`hyperdrive/test/${test}`, { './helpers/create': create }))
