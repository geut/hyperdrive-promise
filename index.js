const hyperdrive = require('hyperdrive')

const callbackMethods = require('./callback-methods')

const kHyperdrive = Symbol('hyperdrive')

const getHyperdrive = drive => drive[kHyperdrive]

class HyperdrivePromise {
  constructor (...args) {
    let drive
    if (args.length === 1 && args[0].readFile) {
      drive = args[0]
    } else {
      drive = hyperdrive(...args)
    }

    this._createDiffStream.bind(this)
    this._checkout.bind(this)

    return new Proxy(drive, this)
  }

  get (target, propKey) {
    if (propKey === kHyperdrive) return target

    if (propKey === 'createDiffStream') return this._createDiffStream
    if (propKey === 'checkout') return this._checkout
    const value = Reflect.get(target, propKey)
    if (callbackMethods.includes(propKey)) return this._buildCallbackPromise(target, value)
    if (typeof value === 'function') return (...args) => Reflect.apply(value, target, args)
    return value
  }

  _buildCallbackPromise (target, func) {
    return (...args) => {
      // We keep suporting the callback style if we get a callback.
      if (typeof args[args.length - 1] === 'function') {
        return Reflect.apply(func, target, args)
      }

      return new Promise((resolve, reject) => {
        args.push((err, ...result) => {
          if (err) return reject(err)
          if (result.length > 1) {
            resolve(result)
          } else {
            resolve(result[0])
          }
        })

        Reflect.apply(func, target, args)
      })
    }
  }

  _createDiffStream (other, prefix, opts) {
    if (other instanceof HyperdrivePromise) {
      other = getHyperdrive(other)
    }

    return getHyperdrive(this).createDiffStream(other, prefix, opts)
  }

  _checkout (version, opts) {
    const h = getHyperdrive(this).checkout(version, opts)
    return new HyperdrivePromise(h)
  }
}

module.exports = (...args) => new HyperdrivePromise(...args)
module.exports.getHyperdrive = getHyperdrive
