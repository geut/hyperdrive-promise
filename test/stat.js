var tape = require('tape')
var create = require('./helpers/create')

var mask = 511 // 0b111111111

tape('stat file', async t => {
  var drive = create()

  try {
    await drive.writeFile('/foo', 'bar', { mode: 438 })
    const st = await drive.stat('/foo')
    t.same(st.isDirectory(), false)
    t.same(st.isFile(), true)
    t.same(st.mode & mask, 438)
    t.same(st.size, 3)
    t.same(st.offset, 0)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('stat dir', async t => {
  var drive = create()

  console.log('going into mkdir')
  try {
    await drive.mkdir('/foo')
    console.log('after mkdir')
    const st = await drive.stat('/foo')
    console.log('right here')
    t.same(st.isDirectory(), true)
    t.same(st.isFile(), false)
    t.same(st.mode & mask, 493)
    t.same(st.offset, 0)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('metadata', async t => {
  var archive = create()

  var attributes = { hello: 'world' }
  var metadata = {
    attributes: Buffer.from(JSON.stringify(attributes))
  }

  try {
    await archive.writeFile('/foo', 'bar', { metadata })
    await archive.stat('/foo')
    t.deepEqual(JSON.parse(metadata.attributes.toString()), { hello: 'world' })
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})
