var Hyperdrive = require('hyperdrive')

const promiseHandler = (resolve, reject) => (err, ...rest) => {
  if (err) {
    return reject(err)
  }
  resolve(...rest)
}

const callAny = (obj) => {
  const handler = {
    get (target, propKey, receiver) {
      if (target[propKey]) return target[propKey]

      const origMethod = target.h[propKey]
      if (typeof origMethod !== 'function') return origMethod
      return function (...args) {
        const result = origMethod.apply(this, args)
        console.log(propKey + JSON.stringify(args) + ' -> ' + JSON.stringify(result))
        return result
      }
    }
  }
  return new Proxy(obj, handler)
}

class HyperPromise {
  constructor (storage, key, opts) {
    this.h = Hyperdrive(storage, key, opts)
  }

  async saycool (name) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(`cool name ${name}`)
      }, 2000)
    })
  }

  async ready () {
    return new Promise((resolve, reject) => {
      this.h._ready(promiseHandler(resolve, reject))
    })
  }

  async open (name, flags) {
    return new Promise((resolve, reject) => {
      this.h.open(name, flags, promiseHandler(resolve, reject))
    })
  }

  async read (fd, buf, offset, len, pos) {
    return new Promise((resolve, reject) => {
      this.h.read(fd, buf, offset, len, pos, promiseHandler(resolve, reject))
    })
  }

  async write (fd, buf, offset, len, pos) {
    return new Promise((resolve, reject) => {
      this.h.write(fd, buf, offset, len, pos, promiseHandler(resolve, reject))
    })
  }

  async create (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.create(name, opts, promiseHandler(resolve, reject))
    })
  }

  async readFile (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.readFile(name, opts, promiseHandler(resolve, reject))
    })
  }

  async writeFile (name, buf, opts) {
    return new Promise((resolve, reject) => {
      this.h.writeFile(name, buf, opts, promiseHandler(resolve, reject))
    })
  }

  async truncate (name, size) {
    return new Promise((resolve, reject) => {
      this.h.truncate(name, size, promiseHandler(resolve, reject))
    })
  }

  async mkdir (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.mkdir(name, opts, promiseHandler(resolve, reject))
    })
  }

  async lstat (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.lstat(name, opts, promiseHandler(resolve, reject))
    })
  }

  async stat (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.stat(name, opts, promiseHandler(resolve, reject))
    })
  }

  async access (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.access(name, opts, promiseHandler(resolve, reject))
    })
  }

  async exists (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.exists(name, opts, promiseHandler(resolve, reject))
    })
  }

  async readdir (name, opts) {
    return new Promise((resolve, reject) => {
      this.h.readdir(name, opts, promiseHandler(resolve, reject))
    })
  }

  async unlink (name) {
    return new Promise((resolve, reject) => {
      this.h.unlink(name, promiseHandler(resolve, reject))
    })
  }

  async rmdir (name) {
    return new Promise((resolve, reject) => {
      this.h.rmdir(name, promiseHandler(resolve, reject))
    })
  }

  async close (fd) {
    return new Promise((resolve, reject) => {
      this.h.close(fd, promiseHandler(resolve, reject))
    })
  }

  async fileStats (path, opts) {
    return new Promise((resolve, reject) => {
      this.h.fileStats(path, opts, promiseHandler(resolve, reject))
    })
  }

  async mount (path, key, opts) {
    return new Promise((resolve, reject) => {
      this.h.mount(path, key, promiseHandler(resolve, reject))
    })
  }

  async unmount (path) {
    return new Promise((resolve, reject) => {
      this.h.unmount(path, promiseHandler(resolve, reject))
    })
  }

  async symlink (target, linkName) {
    return new Promise((resolve, reject) => {
      this.h.symlink(target, linkName, promiseHandler(resolve, reject))
    })
  }

  async getAllMounts (opts) {
    return new Promise((resolve, reject) => {
      this.h.getAllMounts(opts, promiseHandler(resolve, reject))
    })
  }
}

module.exports = (...args) => {
  const h = new HyperPromise(...args)
  return callAny(h)
}
