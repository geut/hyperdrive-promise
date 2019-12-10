const tape = require('tape')
const create = require('./helpers/create')

tape('simple checkout', async (t) => {
  const drive = create()

  try {
    await drive.writeFile('/hello', 'world')

    const version = drive.version

    const data = await drive.readFile('/hello')

    t.same(data, Buffer.from('world'))

    try {
      await drive.unlink('/hello')
      await drive.readFile('/hello')
    } catch (err) {
      t.true(err)
      t.same(err.code, 'ENOENT')
      await testCheckout(version)
    }
  } catch (err) {
    t.error(err, 'no error')
  }

  async function testCheckout (version) {
    const oldVersion = drive.checkout(version)
    try {
      const data = await oldVersion.readFile('/hello')
      t.same(data, Buffer.from('world'))
    } catch (err) {
      console.log(err)
      t.error(err, 'no error')
    }
    t.end()
  }
})

// TODO: Re-enable the following tests once the `download` and `fetchLatest` APIs are reimplemented.

tape('download a version', async (t) => {
  var src = create()
  await src.ready()

  /*
  t.ok(src.writable)
  t.ok(src.metadata.writable)
  t.ok(src.content.writable)
  */
  try {
    await src.writeFile('/first.txt', 'number 1')

    await src.writeFile('/second.txt', 'number 2')

    await src.writeFile('/third.txt', 'number 3')
    t.same(src.version, 4)
    await testDownloadVersion()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function testDownloadVersion () {
    const clone = create(src.key, { sparse: true })

    var stream = clone.replicate()
    stream.pipe(src.replicate()).pipe(stream)

    await clone.ready()
    t.same(clone.version, 4, 'versions should match')

    const handler = clone
      .checkout(3)
    //  .download('/')

    // handler.on('error', (err) => t.error(err))
    // handler.on('finish', async (data) => {
    const content = await handler.readFile('/second.txt', { cached: true })
    t.same(content && content.toString(), 'number 2', 'content does not match')
    handler.readFile('/third.txt', { cached: true })
      .catch(err => {
        t.same(err && err.message, "No such file or directory: '/third.txt'.")
        t.end()
      })
    // })
  }
})

tape.skip('closing a read-only, latest clone', function (t) {
  // This is just a sample key of a dead dat
  var clone = create('1d5e5a628d237787afcbfec7041a16f67ba6895e7aa31500013e94ddc638328d', {
    latest: true
  })
  clone.on('error', function (err) {
    t.fail(err)
  })
  clone.close(function (err) {
    t.error(err)
    t.end()
  })
})
