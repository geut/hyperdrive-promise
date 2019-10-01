const tape = require('tape')
const create = require('./helpers/create')

tape('owner is writable', async (t) => {
  var archive = create()
  await archive.ready()
  t.ok(archive.writable)
  t.ok(archive.metadata.writable)
  t.end()
})
