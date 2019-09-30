const tape = require('tape')
const create = require('./helpers/create')

tape('basic fd read', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)
    const fd = await drive.open('hi', 'r')
    t.same(typeof fd, 'number')
    t.ok(fd > 5)

    const underflow = 37
    const buf = Buffer.alloc(content.length - underflow)
    let pos = 0

    let bytesRead = await drive.read(fd, buf, 0, buf.length, 0)
    pos += bytesRead
    t.same(bytesRead, buf.length, 'filled the buffer')
    t.same(buf, content.slice(0, buf.length))

    bytesRead = await drive.read(fd, buf, 0, buf.length, pos)
    pos += bytesRead
    t.same(bytesRead, underflow, 'read missing bytes')
    t.same(buf.slice(0, underflow), content.slice(content.length - underflow))
    t.same(pos, content.length, 'read full file')

    bytesRead = await drive.read(fd, buf, 0, buf.length, pos)
    t.same(bytesRead, 0, 'no more to read')

    await drive.close(fd)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('basic fd read with implicit position', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)

    const fd = await drive.open('hi', 'r')
    t.same(typeof fd, 'number')
    t.ok(fd > 5)

    const underflow = 37
    const buf = Buffer.alloc(content.length - underflow)
    let pos = 0

    let bytesRead = await drive.read(fd, buf, 0, buf.length)
    pos += bytesRead
    t.same(bytesRead, buf.length, 'filled the buffer')
    t.same(buf, content.slice(0, buf.length))

    bytesRead = await drive.read(fd, buf, 0, buf.length)
    pos += bytesRead
    t.same(bytesRead, underflow, 'read missing bytes')
    t.same(buf.slice(0, underflow), content.slice(content.length - underflow))
    t.same(pos, content.length, 'read full file')

    bytesRead = await drive.read(fd, buf, 0, buf.length)
    t.same(bytesRead, 0, 'no more to read')

    await drive.close(fd)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd read with zero length', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)

    const fd = await drive.open('hi', 'r')

    const buf = Buffer.alloc(content.length)

    const bytesRead = await drive.read(fd, buf, 0, 0)
    t.same(bytesRead, 0)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd read with out-of-bounds offset', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)

    const fd = await drive.open('hi', 'r')

    const buf = Buffer.alloc(content.length)

    const bytesRead = await drive.read(fd, buf, content.length, 10)
    t.same(bytesRead, 0)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd read with out-of-bounds length', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)

    const fd = await drive.open('hi', 'r')

    const buf = Buffer.alloc(content.length)

    const bytesRead = await drive.read(fd, buf, 0, content.length + 1)
    t.same(bytesRead, content.length)
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd read of empty drive', async t => {
  const drive = create()
  try {
    await drive.open('hi', 'r')
  } catch (err) {
    t.true(err)
    t.same(err.errno, 2)
    t.end()
  }
})

tape('fd read of invalid file', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    await drive.writeFile('hi', content)
    try {
      await drive.open('hello', 'r')
    } catch (err) {
      t.true(err)
      t.same(err.errno, 2)
      t.end()
    }
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd basic write, creating file', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')

  try {
    const fd = await drive.open('hello', 'w+')
    const bytesWritten = await drive.write(fd, content, 0, content.length, 0)
    t.same(bytesWritten, content.length)
    await drive.close(fd)
    const readContent = await drive.readFile('hello')
    t.true(readContent.equals(content))
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('fd basic write, appending file', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')
  const first = content.slice(0, 2000)
  const second = content.slice(2000)

  try {
    await drive.writeFile('hello', first)
    await writeSecond()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function writeSecond () {
    try {
      const fd = await drive.open('hello', 'a')
      const bytesWritten = await drive.write(fd, second, 0, second.length, first.length)
      t.same(bytesWritten, second.length)
      await drive.close(fd)
      const readContent = await drive.readFile('hello')
      t.true(readContent.equals(content))
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

tape('fd basic write, overwrite file', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')
  const first = content.slice(0, 2000)
  const second = content.slice(2000)

  try {
    await drive.writeFile('hello', first)
    await writeSecond()
  } catch (err) {
    t.error(err, 'no error')
  }

  async function writeSecond () {
    try {
      const fd = await drive.open('hello', 'w')
      const bytesWritten = await drive.write(fd, second, 0, second.length, 0)
      t.same(bytesWritten, second.length)
      await drive.close(fd)
      const readContent = await drive.readFile('hello')
      t.true(readContent.equals(second))
      t.end()
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

tape('fd stateful write', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')
  const first = content.slice(0, 2000)
  const second = content.slice(2000)

  try {
    const fd = await drive.open('hello', 'w')
    await drive.write(fd, first, 0, first.length, 0)
    await drive.write(fd, second, 0, second.length, first.length)
    await drive.close(fd)
    const readContent = await drive.readFile('hello')
    t.true(readContent.equals(content))
    t.end()
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('huge stateful write + stateless read', async t => {
  const NUM_SLICES = 1000
  const SLICE_SIZE = 4096
  const READ_SIZE = Math.floor(4096 * 2.75)

  const drive = create()

  const content = Buffer.alloc(SLICE_SIZE * NUM_SLICES).fill('0123456789abcdefghijklmnopqrstuvwxyz')
  const slices = new Array(NUM_SLICES).fill(0).map((_, i) => content.slice(SLICE_SIZE * i, SLICE_SIZE * (i + 1)))

  try {
    const fd = await drive.open('hello', 'w+')
    await writeSlices(drive, fd)
    const anotherFd = await drive.open('hello', 'r')
    await compareSlices(drive, anotherFd)
  } catch (err) {
    t.error(err, 'no error')
  }

  async function compareSlices (drive, fd) {
    let read = 0
    await readNext()

    async function readNext () {
      const buf = Buffer.alloc(READ_SIZE)
      const pos = read * READ_SIZE
      try {
        const bytesRead = await drive.read(fd, buf, 0, READ_SIZE, pos)
        if (!buf.slice(0, bytesRead).equals(content.slice(pos, pos + READ_SIZE))) {
          return t.fail(`Slices do not match at position: ${read}`)
        }
        if (++read * READ_SIZE >= NUM_SLICES * SLICE_SIZE) {
          return t.end()
        }
        return readNext(drive, fd)
      } catch (err) {
        return t.fail(err)
      }
    }
  }

  async function writeSlices (drive, fd) {
    let written = 0
    await writeNext()

    async function writeNext () {
      const buf = slices[written]
      await drive.write(fd, buf, 0, SLICE_SIZE)
      if (++written === NUM_SLICES) return drive.close(fd)
      return writeNext()
    }
  }
})

tape('fd random-access write fails', async t => {
  const drive = create()
  const content = Buffer.alloc(10000).fill('0123456789abcdefghijklmnopqrstuvwxyz')
  const first = content.slice(0, 2000)
  const second = content.slice(2000)

  try {
    const fd = await drive.open('hello', 'w')
    await drive.write(fd, first, 0, first.length, 0)
    try {
      await drive.write(fd, second, 0, second.length, first.length - 500)
    } catch (err) {
      t.true(err)
      t.same(err.errno, 9)
      t.end()
    }
  } catch (err) {
    t.error(err, 'no error')
  }
})
