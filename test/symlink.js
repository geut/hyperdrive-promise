var test = require('tape')
var create = require('./helpers/create')

test('basic symlink', async t => {
  const archive = create()

  try {
    await archive.writeFile('/hello.txt', 'world')
    await archive.symlink('/hello.txt', '/link.txt')
    await onlink()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onlink () {
    const st = await archive.stat('/link.txt')
    t.same(st.size, 5)
    const contents = await archive.readFile('/link.txt')
    t.same(contents, Buffer.from('world'))
    t.end()
  }
})

test('fixing a broken symlink', async t => {
  const archive = create()

  try {
    await archive.symlink('/hello.txt', '/link.txt')
    await archive.stat('/link.txt').catch(err => t.same(err.errno, 2))
    await archive.writeFile('/hello.txt', 'world')
    await onwrite()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onwrite () {
    const st = await archive.stat('/link.txt')
    t.same(st.size, 5)
    const contents = await archive.readFile('/link.txt')
    t.same(contents, Buffer.from('world'))
    t.end()
  }
})

test('unlinking a symlink does not delete the target', async t => {
  const archive = create()

  try {
    await archive.writeFile('/hello.txt', 'world')
    await archive.symlink('/hello.txt', '/link.txt')
    await archive.unlink('/link.txt')
    await onunlink()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onunlink () {
    const st = await archive.stat('/hello.txt')
    t.same(st.size, 5)
    const contents = await archive.readFile('/hello.txt')
    t.same(contents, Buffer.from('world'))
    t.end()
  }
})

test('symlinks appear in readdir', async t => {
  const archive = create()

  try {
    await archive.writeFile('/hello.txt', 'world')
    await archive.symlink('/hello.txt', '/link.txt')
    await onlink()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onlink () {
    const files = await archive.readdir('/')
    t.same(files, ['hello.txt', 'link.txt'])
    t.end()
  }
})

test('symlinks with nested symlinks appear in non-recursive readdir', async t => {
  const drive = create()

  try {
    await drive.mkdir('a').catch(t.error)
    await drive.writeFile('a/1', '1')
    await drive.writeFile('a/2', '2')
    await drive.symlink('a/2', 'a/3')
    await drive.symlink('a', 'b')
    await onlink()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function onlink () {
    const files = await drive.readdir('b')
    t.same(files, ['3', '1', '2'])
    t.end()
  }
})
