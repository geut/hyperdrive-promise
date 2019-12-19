const test = require('tape')
const ram = require('random-access-memory')

const Corestore = require('corestore')
const replicateAll = require('./helpers/replicate')
const create = require('./helpers/create')

const createCorestore = (storage, opts) => {
  return Corestore(storage, opts)
}

test('basic read/write to/from a mount', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  try {
    await drive2.ready()
    await drive2.writeFile('b', 'hello')
    await drive1.mount('a', drive2.key)
    const contents = await drive1.readFile('a/b')
    t.same(contents, Buffer.from('hello'))
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('should emit metadata-feed and content-feed events for all mounts', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  var metadataCount = 0
  var contentCount = 0

  drive1.on('metadata-feed', () => {
    metadataCount++
  })
  drive1.on('content-feed', () => {
    contentCount++
  })

  try {
    await drive2.ready()
    await drive2.writeFile('hello', 'world')
    await drive1.mount('a', drive2.key)
    const content = await drive1.readFile('a/hello')
    t.same(content, Buffer.from('world'))
    checkEvents()
  } catch (err) {
    t.error(err, 'no error')
  }

  function checkEvents () {
    t.same(contentCount, 2)
    t.same(metadataCount, 2)
    t.end()
  }
})

test('can delete a mount', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  try {
    await drive2.ready()
    await drive2.writeFile('b', 'hello')
    await drive1.mount('a', drive2.key)
    const contents = await drive1.readFile('a/b')
    t.same(contents, Buffer.from('hello'))
    return deleteMount()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function deleteMount () {
    try {
      await drive1.unmount('a')
      await drive1.readFile('a/b')
    } catch (err) {
      t.true(err)
      t.same(err.errno, 2)
      t.end()
    }
  }
})

test('multiple flat mounts', async t => {
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  var key1, key2

  replicateAll([drive1, drive2, drive3])

  try {
    await drive3.ready()
    await drive2.ready()
    key1 = drive2.key
    key2 = drive3.key
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    try {
      await drive2.writeFile('a', 'hello')
      await drive3.writeFile('b', 'world')
      await onwrite()
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function onwrite () {
    try {
      await drive1.mount('a', key1)
      await drive1.mount('b', key2)
      await onmount()
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function onmount () {
    try {
      const contents = await drive1.readFile('a/a')
      t.same(contents, Buffer.from('hello'))
      const contents2 = await drive1.readFile('b/b')
      t.same(contents2, Buffer.from('world'))
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

test('recursive mounts', async t => {
  var key1, key2
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  replicateAll([drive1, drive2, drive3])

  try {
    await drive3.ready()
    await drive2.ready()
    key1 = drive2.key
    key2 = drive3.key
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    try {
      await drive2.writeFile('a', 'hello')
      await drive3.writeFile('b', 'world')
      await onwrite()
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function onwrite () {
    try {
      await drive1.mount('a', key1)
      await drive2.mount('b', key2)
      await onmount()
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function onmount () {
    try {
      const contents = await drive1.readFile('a/a')
      t.same(contents, Buffer.from('hello'))
      const contents2 = await drive1.readFile('a/b/b')
      t.same(contents2, Buffer.from('world'))
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

test('readdir returns mounts', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  try {
    await drive2.ready()
    await drive1.mkdir('b')
    await drive1.mkdir('b/a')
    await drive1.mount('a', drive2.key)
    const dirs = await drive1.readdir('/')
    t.same(dirs, ['b', 'a'])
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('cross-mount watch', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  var watchEvents = 0

  try {
    await drive2.ready()
    await drive1.mount('a', drive2.key)
    drive1.watch('/', () => {
      if (++watchEvents === 1) t.end()
    })
    await drive2.writeFile('a', 'hello')
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('cross-mount symlink', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  await drive2.ready()
  await drive1.mount('a', drive2.key)
  await onmount()

  async function onmount () {
    try {
      await drive2.writeFile('b', 'hello world')
      await drive1.symlink('a/b', 'c')
      const contents = await drive1.readFile('c')
      t.same(contents, Buffer.from('hello world'))
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

test('lists nested mounts, shared write capabilities', async t => {
  const store = new Corestore(ram)
  await store.ready()

  const drive1 = create({ corestore: store, namespace: 'd1' })
  const drive2 = create({ corestore: store, namespace: 'd2' })
  const drive3 = create({ corestore: store, namespace: 'd3' })

  try {
    await drive3.ready()
    await drive1.mount('a', drive2.key)
    await drive1.mount('a/b', drive3.key)
    await onmount(drive1, drive2)
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onmount (drive1, drive2) {
    await drive2.lstat('b')
    const list = await drive1.readdir('a')
    t.same(list, ['b'])
    t.end()
  }
})

test('independent corestores do not share write capabilities', async t => {
  const drive1 = create()
  const drive2 = create()

  const s1 = drive1.replicate(true, { live: true })
  s1.pipe(drive2.replicate(false, { live: true })).pipe(s1)

  try {
    await drive2.ready()
    await drive1.mount('a', drive2.key)
    await drive1.writeFile('a/b', 'hello').catch(err => t.ok(err))
    await drive1.readFile('a/b').catch(err => {
      t.ok(err)
      t.end()
    })
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('shared corestores will share write capabilities', async t => {
  const store = new Corestore(ram)
  await store.ready()

  const drive1 = create({ corestore: store })
  const drive2 = create({ corestore: store })

  try {
    await drive2.ready()
    await drive1.mount('a', drive2.key)
    await drive1.writeFile('a/b', 'hello')
    const contents = await drive1.readFile('a/b')
    t.same(contents, Buffer.from('hello'))
    const contents2 = await drive2.readFile('b')
    t.same(contents2, Buffer.from('hello'))
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('can mount hypercores', async t => {
  const store = new Corestore(ram)
  await store.ready()

  const drive = create({ corestore: store })
  var core = store.get()

  try {
    await drive.ready()
    core.ready(err => {
      t.error(err, 'no error')
      core.append('hello', err => {
        t.error(err, 'no error')
        return onappend()
      })
    })
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onappend () {
    await drive.mount('/a', core.key, { hypercore: true })
    const contents = await drive.readFile('/a')
    t.same(contents, Buffer.from('hello'))
    t.end()
  }
})

test('truncate within mount (with shared write capabilities)', async t => {
  const store = new Corestore(ram)
  await store.ready()

  const drive1 = create({ corestore: store })
  const drive2 = create({ corestore: store })

  try {
    await drive2.ready()
    await drive1.mount('a', drive2.key)
    await drive1.writeFile('a/b', 'hello')
    await drive1.truncate('a/b', 1)
    const contents = await drive1.readFile('a/b')
    t.same(contents, Buffer.from('h'))
    const contents2 = await drive2.readFile('b')
    t.same(contents2, Buffer.from('h'))
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('mount replication between hyperdrives', async t => {
  const store1 = new Corestore(path => ram('cs1/' + path))
  const store2 = new Corestore(path => ram('cs2/' + path))
  const store3 = new Corestore(path => ram('cs3/' + path))
  await Promise.all([store1.ready(), store2.ready(), store3.ready()])

  const drive1 = create({ corestore: store1 })
  const drive2 = create({ corestore: store2 })
  var drive3 = null

  try {
    await drive1.ready()
    drive3 = create(drive1.key, { corestore: store3 })
    await drive2.ready()
    await drive3.ready()
    replicateAll([drive1, drive2, drive3])
    await onready()
    t.end()
  } catch (err) {
    console.log(err)
    t.error(err, 'no error')
  }

  async function onready () {
    try {
      await drive1.writeFile('hey', 'hi')
      await drive2.writeFile('hello', 'world')
      await drive1.mount('a', drive2.key)
      await drive3.ready()
      return setTimeout(onmount, 100)
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function onmount () {
    const contents = await drive3.readFile('hey')
    t.same(contents, Buffer.from('hi'))
    const contents2 = await drive3.readFile('a/hello')
    t.same(contents2, Buffer.from('world'))

    const contents3 = await drive3.readFile('hey')
    t.same(contents3, Buffer.from('hi'))
    const contents3Hello = await drive3.readFile('a/hello')
    t.same(contents3Hello, Buffer.from('world'))
  }
})

test('mount replication between hyperdrives, multiple, nested mounts', async t => {
  const [d1, d2] = await createMountee()
  const drive = await createMounter(d1, d2)
  await verify(drive)

  t.end()

  async function createMountee () {
    const store = new Corestore(path => ram('cs1/' + path))
    await store.ready()
    const drive1 = create({ corestore: store })
    var drive2, drive3

    try {
      await drive1.ready()
      drive2 = create({ corestore: store })
      drive3 = create({ corestore: store })
      await drive2.ready()
      await drive3.ready()
      return onready()
    } catch (err) {
      t.error(err, 'no error')
    }

    async function onready () {
      await drive1.mount('a', drive2.key)
      await drive1.mount('b', drive3.key)
      return onmount()
    }

    async function onmount () {
      await drive1.writeFile('a/dog', 'hello')
      await drive1.writeFile('b/cat', 'goodbye')
      return [drive2, drive3]
    }
  }

  async function createMounter (d2, d3) {
    const store = new Corestore(path => ram('cs4/' + path))
    await store.ready()
    const drive1 = create({ corestore: store })

    try {
      await drive1.ready()
      replicateAll([drive1, d2, d3])
      await drive1.mount('a', d2.key)
      await drive1.mount('b', d3.key)
      return drive1
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function verify (drive) {
    const contents = await drive.readFile('a/dog')
    t.same(contents, Buffer.from('hello'))
    const contents2 = await drive.readFile('b/cat')
    t.same(contents2, Buffer.from('goodbye'))
  }
})

test('can list in-memory mounts', async t => {
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  var key1, key2

  replicateAll([drive1, drive2, drive3])

  try {
    await drive3.ready()
    await drive2.ready()
    key1 = drive2.key
    key2 = drive3.key
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    await drive2.writeFile('a', 'hello')
    await drive3.writeFile('b', 'world')
    await onwrite()
  }

  async function onwrite () {
    await drive1.mount('a', key1)
    await drive1.mount('b', key2)
    await onmount()
  }

  async function onmount () {
    const contents = await drive1.readFile('a/a')
    t.true(contents)
    const mounts = await drive1.getAllMounts({ memory: true })
    t.same(mounts.size, 2)
    t.true(mounts.get('/'))
    t.true(mounts.get('/a'))
    t.end()
  }
})

test('getAllMounts with no mounts returns only the root mount', async t => {
  const drive1 = create()
  try {
    await drive1.ready()
    const mounts = await drive1.getAllMounts({ memory: true })
    t.true(mounts)
    t.same(mounts.size, 1)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

test('can list all mounts (including those not in memory)', async t => {
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  var key1, key2

  replicateAll([drive1, drive2, drive3])

  try {
    await drive3.ready()
    await drive2.ready()
    key1 = drive2.key
    key2 = drive3.key
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    await drive2.writeFile('a', 'hello')
    await drive3.writeFile('b', 'world')
    await onwrite()
  }

  async function onwrite () {
    await drive1.mount('a', key1)
    await drive1.mount('b', key2)
    onmount()
  }

  async function onmount () {
    const mounts = await drive1.getAllMounts()
    t.same(mounts.size, 3)
    t.true(mounts.get('/'))
    t.true(mounts.get('/a'))
    t.true(mounts.get('/b'))
    t.end()
  }
})

test('can watch nested mounts', async t => {
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  var key1, key2

  replicateAll([drive1, drive2, drive3])

  await drive3.ready()

  await drive2.ready()
  key1 = drive2.key
  key2 = drive3.key
  await onready()

  async function onready () {
    await drive1.mount('a', key1)
    await drive2.mount('b', key2)
    await onmount()
  }

  async function onmount () {
    var changes = 0
    const watcher = drive1.watch('', () => {
      changes++
    })
    watcher.on('ready', async watchers => {
      t.same(watchers.length, 2)
      await drive2.writeFile('a', 'hello')
      await drive3.writeFile('b', 'world')
      setImmediate(() => {
        t.same(changes, 3)
        t.end()
      })
    })
  }
})

test('can watch cyclic mounts', async t => {
  const drive1 = create()
  const drive2 = create()

  var key1, key2

  replicateAll([drive1, drive2])

  await drive1.ready()
  await drive2.ready()
  key1 = drive1.key
  key2 = drive2.key
  await onready()

  async function onready () {
    await drive1.mount('a', key2)
    await drive2.mount('b', key1)
    await onmount()
  }

  async function onmount () {
    var changes = 0
    const watcher = drive1.watch('', () => {
      changes++
    })
    watcher.on('ready', async watchers => {
      t.same(watchers.length, 2)
      await drive2.writeFile('c', 'hello')
      await drive1.writeFile('c', 'world')
      setImmediate(() => {
        t.same(changes, 4)
        t.end()
      })
    })
  }
})

test('can list in-memory mounts recursively')
test('dynamically resolves cross-mount symlinks')
test('symlinks cannot break the sandbox')
test('versioned mount')
test('watch will unwatch on umount')
