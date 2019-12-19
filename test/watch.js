var tape = require('tape')
var create = require('./helpers/create')

tape('simple watch', async t => {
  const db = create(null)

  var watchEvents = 0
  await db.ready()
  db.watch('/a/path/', () => {
    if (++watchEvents === 2) {
      t.end()
    }
  })

  await doWrites()

  async function doWrites () {
    await db.writeFile('/a/path/hello', 't1')
    await db.writeFile('/b/path/hello', 't2')
    await db.writeFile('/a/path/world', 't3')
  }
})
