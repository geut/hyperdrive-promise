const tape = require('tape')
const create = require('./helpers/create')

tape('write and unlink', async (t) => {
  var archive = create()

  try {
    await archive.writeFile('/hello.txt', 'world')
    await archive.unlink('/hello.txt')
    await archive.readFile('/hello.txt').catch(err => {
      t.ok(err, 'had error')
      t.end()
    })
  } catch (err) {
    t.error(err, 'no error')
  }
})
