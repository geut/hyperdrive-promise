const t = require('tape')
const _tape = require('tape-promise').default
const tape = _tape(t)
const create = require('./helpers/create')

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
