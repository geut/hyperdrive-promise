const t = require('tape')
const _tape = require('tape-promise').default
const tape = _tape(t)
const create = require('./helpers/create')

tape('owner is writable', async (t) => {
  var archive = create()
  await archive.ready()
  t.ok(archive.writable)
  t.ok(archive.metadata.writable)
  t.end()
})
