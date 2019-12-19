const tape = require('tape')
const tmp = require('temporary-directory')
const create = require('./helpers/create')
const hyperpromise = require('..')

tape('ram storage', async t => {
  var drive = create()

  await drive.ready()
  t.ok(drive.metadata.writable, 'drive metadata is writable')
  t.ok(drive.contentWritable, 'drive content is writable')
  t.end()
})

tape('dir storage with resume', async t => {
  tmp(async (err, dir, cleanup) => {
    t.ifError(err)
    var drive = hyperpromise(dir)
    try {
      await drive.ready()
      t.ok(drive.metadata.writable, 'drive metadata is writable')
      t.ok(drive.contentWritable, 'drive content is writable')
      t.same(drive.version, 1, 'drive has version 1')
      await drive.close()

      var drive2 = hyperpromise(dir)
      await drive2.ready()
      t.ok(drive2.metadata.writable, 'drive2 metadata is writable')
      t.ok(drive2.contentWritable, 'drive2 content is writable')
      t.same(drive2.version, 1, 'drive has version 1')

      cleanup(function (err) {
        t.ifError(err)
        t.end()
      })
    } catch (err) {
      t.ifError(err)
    }
  })
})

tape('dir storage for non-writable drive', async t => {
  var src = create()
  await src.ready()
  tmp(async (err, dir, cleanup) => {
    t.ifError(err)

    var clone = hyperpromise(dir, src.key)
    await clone.ready()
    t.ok(!clone.metadata.writable, 'clone metadata not writable')
    t.ok(!clone.contentWritable, 'clone content not writable')
    t.same(clone.key, src.key, 'keys match')
    cleanup(function (err) {
      t.ifError(err)
      t.end()
    })

    var stream = clone.replicate(true)
    stream.pipe(src.replicate(false)).pipe(stream)
  })
})

tape('dir storage without permissions emits error', t => {
  t.plan(2)
  var drive = hyperpromise('/')
  drive.on('error', function (err) {
    t.ok(err, 'got error')
  })
})

tape('write and read (sparse)', async (t) => {
  t.plan(2)

  tmp(async (err, dir, cleanup) => {
    t.ifError(err)
    var drive = hyperpromise(dir)
    await drive.ready()
    var clone = create(drive.key, { sparse: true })
    await clone.ready()
    try {
      await drive.writeFile('/hello.txt', 'world')
      var stream = clone.replicate(true, { live: true, encrypt: false })
      stream.pipe(drive.replicate(false, { live: true, encrypt: false })).pipe(stream)
      setTimeout(() => {
        var readStream = clone.createReadStream('/hello.txt')
        readStream.on('error', function (err) {
          t.error(err, 'no error')
        })
        readStream.on('data', function (data) {
          t.same(data.toString(), 'world')
        })
      }, 50)
    } catch (err) {
      t.error(err, 'no error')
    }
  })
})

tape('sparse read/write two files', async (t) => {
  var drive = create()
  await drive.ready()
  var clone = create(drive.key, { sparse: true })

  try {
    await drive.writeFile('/hello.txt', 'world')
    await drive.writeFile('/hello2.txt', 'world')
    var stream = clone.replicate(true, { live: true, encrypt: false })
    stream.pipe(drive.replicate(false, { live: true, encrypt: false })).pipe(stream)
    clone.metadata.update(start)
  } catch (err) {
    t.error(err, 'no error')
  }

  async function start () {
    try {
      const stat = await clone.stat('/hello.txt')
      t.ok(stat, 'has stat')
      const data = await clone.readFile('/hello.txt')
      t.same(data.toString(), 'world', 'data ok')
      const stat2 = await clone.stat('/hello2.txt')
      t.ok(stat2, 'has stat')
      const data2 = await clone.readFile('/hello2.txt')
      t.same(data2.toString(), 'world', 'data ok')
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})
