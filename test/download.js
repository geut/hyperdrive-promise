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
      const totals = await drive2.fileStats('hello')
      t.same(totals.blocks, 1)
      t.same(totals.downloadedBlocks, 0)
      const [ total, byFile ] = await drive2.download('hello', { detailed: true })
      t.same(total.downloadedBlocks, 1)
      t.same(total.downloadedBytes, 5)
      t.same(byFile.get('hello').downloadedBlocks, 1)
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
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
        const handle = drive2.download('a', { detailed: true })
        ondownloading(handle)
      })
    } catch (err) {
      t.error(err, 'no error')
    }
  }

  function ondownloading (handle) {
    handle.on('finish', (total, byFile) => {
      t.same(total.downloadedBlocks, 3)
      t.same(total.downloadedBytes, Buffer.from('1').length * 3)
      t.same(byFile.get('/a/1').downloadedBlocks, 1)
      t.same(byFile.get('/a/2').downloadedBlocks, 1)
      t.same(byFile.get('/a/3').downloadedBlocks, 1)
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
      handle.cancel()
    }, 1000)
    handle.on('cancel', (err, total, byFile) => {
      if (err) t.fail(err)
      t.true(total.downloadedBlocks > 0)
      t.true(total.downloadedBlocks < 100)
      t.true(byFile.get('a').downloadedBlocks > 0)
      t.true(byFile.get('a').downloadedBlocks < 100)
      t.end()
    })
    handle.on('error', t.fail.bind(t))
  }
})

