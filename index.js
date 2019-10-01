const hyperdrive = require('hyperdrive')

const callbackMethods = ['ready', 'readFile', 'writeFile', 'unlink', 'mkdir',
  'rmdir', 'readdir', 'stat', 'lstat', 'access', 'open', 'read', 'write', 'symlink', 'mount', 'unmount', 'getAllMounts', 'close', 'fileStats', 'truncate']

class HyperdrivePromise {
  constructor (...args) {
    // Note (dk): check if first arg is an hyperdrive
    if (args.length === 1 && args[0].readFile) {
      this.h = args[0]
    } else {
      this.h = hyperdrive(...args)
    }

    this._createDiffStream.bind(this)
    this._checkout.bind(this)

    return new Proxy(this, this)
  }

  get (target, propKey, receiver) {
    if (propKey === 'h') return this.h
    if (propKey === 'createDiffStream') return this._createDiffStream
    if (propKey === 'checkout') return this._checkout
    if (callbackMethods.includes(propKey)) return this._buildPromise(propKey)
    if (typeof this.h[propKey] === 'function') return (...args) => this.h[propKey](...args)
    return this.h[propKey]
  }

  _buildPromise (method) {
    return (...args) => new Promise((resolve, reject) => {
      args.push((err, ...rest) => {
        if (err) return reject(err)
        resolve(...rest)
      })
      this.h[method](...args)
    })
  }

  _createDiffStream (other, prefix, opts) {
    if (other instanceof HyperdrivePromise) {
      other = other.h
    }

    return this.h.createDiffStream(other, prefix, opts)
  }

  _checkout (version, opts) {
    const h = this.h.checkout(version, opts)
    return new HyperdrivePromise(h)
  }
}

module.exports = (...args) => new HyperdrivePromise(...args)
