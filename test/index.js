const H = require('../')
const ram = require('random-access-memory')
const t = require('tape')
const _tape = require('tape-promise').default
const tape = _tape(t)

// Tests Helpers
function create (key, opts) {
  if (key && !(key instanceof Buffer)) {
    opts = key
    key = null
  }
  return H(ram, key, { persist: false, ...opts })
}

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
