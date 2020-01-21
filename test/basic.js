const { promisify } = require('util')
const { join } = require('path')
const tape = require('tape')
const hypercoreCrypto = require('hypercore-crypto')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const create = require('./helpers/create')
const tmp = promisify(require('temporary-directory'))
const raf = require('random-access-file')

// END Helpers

tape('close event', async (t) => {
  t.plan(1)

  var drive = create()

  drive.on('close', function () {
    t.pass('close event')
    t.end()
  })

  await drive.ready()
  drive.close()
})

tape('write and read', async (t) => {
  var drive = create()
  try {
    await drive.writeFile('/hello.txt', 'world')

    const out = await drive.readFile('/hello.txt')
    t.same(out, Buffer.from('world'))
    t.end()
  } catch (err) {
    console.log(err)
    t.error(err, 'no error')
  }
})

tape('write and read, with encoding', async t => {
  var drive = create()

  await drive.writeFile('/hello.txt', 'world', { encoding: 'utf8' })

  const str = await drive.readFile('/hello.txt', { encoding: 'utf8' })
  t.same(str, 'world')
  t.end()
})

tape('write and read (2 parallel)', async t => {
  t.plan(2)

  var drive = create()

  await drive.writeFile('/hello.txt', 'world')
  const buf = await drive.readFile('/hello.txt')
  t.same(buf, Buffer.from('world'))

  await drive.writeFile('/world.txt', 'hello')
  const buf2 = await drive.readFile('/world.txt')
  t.same(buf2, Buffer.from('hello'))
})

tape('write and read (sparse)', async t => {
  var drive = create()

  await drive.ready()
  var clone = create(drive.key)

  var s1 = clone.replicate(true, { live: true })
  var s2 = drive.replicate(false, { live: true })
  s1.pipe(s2).pipe(s1)

  await drive.writeFile('/hello.txt', 'world')
  var readStream = clone.createReadStream('/hello.txt')
  readStream.on('data', function (data) {
    t.same(data.toString(), 'world')
    t.end()
  })
})

tape('root is always there', async t => {
  var drive = create()

  await drive.access('/')
  const list = await drive.readdir('/')
  t.same(list, [])
  t.end()
})

tape('provide keypair', async t => {
  const keyPair = hypercoreCrypto.keyPair()
  var drive = create(keyPair.publicKey, { keyPair })

  await drive.ready()
  t.ok(drive.writable)
  t.ok(drive.metadata.writable)
  t.ok(keyPair.publicKey.equals(drive.key))

  await drive.writeFile('/hello.txt', 'world')
  const buf = await drive.readFile('/hello.txt')
  t.same(buf, Buffer.from('world'))
  t.end()
})

tape.skip('can reopen when providing a keypair', async t => {
  const keyPair = hypercoreCrypto.keyPair()

  const tmpDir = await tmp()
  const store = new Corestore(tmpDir)
  const namespace = keyPair.publicKey.toString('hex')
  const drive = create(keyPair.publicKey, { keyPair, corestore: store, namespace })

  await drive.ready()
  t.ok(drive.writable)
  t.ok(drive.metadata.writable)
  t.ok(keyPair.publicKey.equals(drive.key))

  await drive.writeFile('/hello.txt', 'world')
  console.log('CORE LENGTH BEFORE CLOSE:', drive.metadata.length)
  await drive.close()

  const drive2 = create(keyPair.publicKey, { corestore: store, namespace, key: null })

  await drive2.ready()
  console.log('CORE LENGTH:', drive2.metadata.length)
  t.ok(drive2.writable)
  t.ok(drive2.metadata.writable)
  t.ok(keyPair.publicKey.equals(drive2.key))

  const buf = await drive2.readFile('/hello.txt')
  t.same(buf, Buffer.from('world'))
  t.end()
})

tape('write and read, no cache', async t => {
  var drive = create({
    metadataStorageCacheSize: 0,
    contentStorageCacheSize: 0,
    treeCacheSize: 0
  })

  await drive.writeFile('/hello.txt', 'world')
  const buf = await drive.readFile('/hello.txt')
  t.same(buf, Buffer.from('world'))
  t.end()
})

tape('can read a single directory', async function (t) {
  const drive = create(null)

  const files = ['a', 'b', 'c', 'd', 'e', 'f']
  const fileSet = new Set(files)

  for (const file of files) {
    await drive.writeFile(file, 'a small file')
  }

  const files2 = await drive.readdir('/')
  for (const file of files2) {
    t.true(fileSet.has(file), 'correct file was listed')
    fileSet.delete(file)
  }
  t.same(fileSet.size, 0, 'all files were listed')
  t.end()
})

tape('can read sparse metadata', async t => {
  const { read, write } = await getTestDrives()

  const files = ['a', 'b/a/b', 'b/c', 'c/b', 'd/e/f/g/h', 'd/e/a', 'e/a', 'e/b', 'f', 'g']

  for (const file of files) {
    await write.writeFile(file, 'a small file')
    const st = await read.stat(file)
    t.true(st)
  }

  t.end()

  async function getTestDrives () {
    const drive = create()
    await drive.ready()
    const clone = create(drive.key, { sparseMetadata: true, sparse: true })
    const s1 = clone.replicate(true, { live: true })
    s1.pipe(drive.replicate(false, { live: true })).pipe(s1)
    return { read: clone, write: drive }
  }
})

tape('unavailable drive becomes ready', async t => {
  var drive1 = create()
  var drive2 = null

  await drive1.ready()
  drive2 = create(drive1.key)
  await drive2.ready()
  try {
    await drive2.readFile('blah')
  } catch (err) {
    t.true(err)
    t.same(err.errno, 2)
    t.end()
  }
})

tape('reopen local drive with namespace', async t => {
  const getCoreStore = (base, name) => {
    const storageLocation = join(
      base,
      name
    )
    return (file) => raf(join(storageLocation, file))
  }

  const tmpDir = await tmp()
  const { publicKey, secretKey } = hypercoreCrypto.keyPair()

  // drive1
  const store = new Corestore(getCoreStore(tmpDir, '.dat'))
  await store.ready()
  const namespace = publicKey.toString('hex')
  var drive1 = create(publicKey, { corestore: store, namespace, keyPair: { publicKey, secretKey } })

  await drive1.ready()

  await drive1.writeFile('/hello.txt', 'world')

  // drive2
  const drive2 = create(drive1.key, { corestore: store, namespace })
  await drive2.ready()

  const out1 = await drive2.readFile('/hello.txt')
  t.same(out1, Buffer.from('world'))

  await drive2.writeFile('/hello.txt', 'hola')

  const out2 = await drive2.readFile('/hello.txt')
  t.same(out2, Buffer.from('hola'))

  t.end()
})
