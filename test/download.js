const test = require('tape')

const replicateAll = require('./helpers/replicate')
const create = require('./helpers/create')

test('single-file download', async t => {
  const drive1 = create()
  var drive2 = null

  try {
    await drive1.ready()
    drive2 = create(drive1.key)
    await drive2.ready()
    replicateAll([drive1, drive2])
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    try {
      await drive1.writeFile('hello', 'world')
      const totals = await drive2.stats('hello')
      t.same(totals.blocks, 1)
      t.same(totals.downloadedBlocks, 0)
      const handle = drive2.download('hello')
      ondownloading(handle)
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  async function ondownloading (handle) {
    handle.on('finish', async () => {
      const totals = await drive2.stats('hello')
      t.same(totals.downloadedBlocks, 1)
      t.end()
    })
    handle.on('error', t.fail.bind(t))
    handle.on('cancel', t.fail.bind(t))
  }
})

test('directory download', async t => {
  const drive1 = create()
  var drive2 = null

  try {
    await drive1.ready()
    drive2 = create(drive1.key)
    await drive2.ready()
    replicateAll([drive1, drive2])
    await onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onready () {
    try {
      await drive1.writeFile('a/1', '1')
      await drive1.writeFile('a/2', '2')
      await drive1.writeFile('a/3', '3')
      setImmediate(() => {
        const handle = drive2.download('a', { maxConcurrent: 1 })
        ondownloading(handle)
      })
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  function ondownloading (handle) {
    handle.on('finish', async () => {
      const totals = await drive2.stats('a')
      t.same(totals.get('/a/1').downloadedBlocks, 1)
      t.same(totals.get('/a/2').downloadedBlocks, 1)
      t.same(totals.get('/a/3').downloadedBlocks, 1)
      t.end()
    })
    handle.on('error', t.fail.bind(t))
    handle.on('cancel', t.fail.bind(t))
  }
})

test('download cancellation', async t => {
  const drive1 = create()
  var drive2 = null

  try {
    await drive1.ready()
    drive2 = create(drive1.key)
    await drive2.ready()
    replicateAll([drive1, drive2], { throttle: 50 })
    onready()
  } catch (err) {
    t.error(err, 'no error')
  }

  function onready () {
    const writeStream = drive1.createWriteStream('a')
    var chunks = 100
    return write()

    function write () {
      writeStream.write(Buffer.alloc(1024 * 1024).fill('abcdefg'), err => {
        if (err) return t.fail(err)
        if (--chunks) return write()
        return writeStream.end(() => {
          return onwritten()
        })
      })
    }
  }

  function onwritten () {
    setTimeout(() => {
      const handle = drive2.download('a', { detailed: true, statsInterval: 50 })
      ondownloading(handle)
    }, 500)
  }

  function ondownloading (handle) {
    setTimeout(() => {
      handle.destroy()
    }, 1000)
    handle.on('finish', async (err, total, byFile) => {
      if (err) t.fail(err)
      const totals = await drive2.stats('a')
      t.true(totals.downloadedBlocks > 0 && totals.downloadedBlocks < 100)
      t.end()
    })
    handle.on('error', t.fail.bind(t))
  }
})

