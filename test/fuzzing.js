const tape = require('tape')
const collect = require('stream-collector')

const FuzzBuzz = require('fuzzbuzz')
const create = require('./helpers/create')

const MAX_PATH_DEPTH = 30
const MAX_FILE_LENGTH = 1e3
const CHARACTERS = 1e3
const APPROX_READS_PER_FD = 5
const APPROX_WRITES_PER_FD = 5
const INVALID_CHARS = new Set(['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', '.', ' ', '\n', '\t', '\r'])

class HyperdriveFuzzer extends FuzzBuzz {
  constructor (opts) {
    super(opts)

    this.add(10, this.writeFile)
    this.add(5, this.deleteFile)
    this.add(5, this.existingFileOverwrite)
    this.add(5, this.randomStatefulFileDescriptorRead)
    this.add(5, this.randomStatefulFileDescriptorWrite)
    this.add(3, this.statFile)
    // this.add(3, this.statDirectory)
    this.add(2, this.deleteInvalidFile)
    this.add(2, this.randomReadStream)
    this.add(2, this.randomStatelessFileDescriptorRead)
    this.add(1, this.createReadableFileDescriptor)
    // this.add(1, this.writeAndMkdir)
  }

  // START Helper functions.

  _select (map) {
    let idx = this.randomInt(map.size - 1)
    if (idx < 0) return null

    const ite = map.entries()
    while (idx--) ite.next()
    return ite.next().value
  }

  _selectFile () {
    return this._select(this.files)
  }

  _selectDirectory () {
    return this._select(this.directories)
  }

  _selectReadableFileDescriptor () {
    return this._select(this.readable_fds)
  }

  _validChar () {
    do {
      var char = String.fromCharCode(this.randomInt(CHARACTERS))
    } while (INVALID_CHARS.has(char))
    return char
  }

  _fileName () {
    do {
      let depth = Math.max(this.randomInt(MAX_PATH_DEPTH), 1)
      var name = (new Array(depth)).fill(0).map(() => this._validChar()).join('/')
    } while (this.files.get(name) || this.directories.get(name))
    return name
  }

  _content () {
    return Buffer.allocUnsafe(this.randomInt(MAX_FILE_LENGTH)).fill(0).map(() => this.randomInt(10))
  }

  _createFile () {
    let name = this._fileName()
    let content = this._content()
    return { name, content }
  }

  _deleteFile (name) {
    return new Promise((resolve, reject) => {
      this.drive.unlink(name, err => {
        if (err) return reject(err)
        this.files.delete(name)
        return resolve({ type: 'delete', name })
      })
    })
  }

  // START FuzzBuzz interface

  async _setup () {
    this.drive = create()
    this.files = new Map()
    this.directories = new Map()
    this.streams = new Map()
    this.readable_fds = new Map()
    this.log = []

    await this.drive.ready()
  }

  _validationDrive () {
    return this.drive
  }

  async _validateFile (name, content) {
    let drive = this._validationDrive()
    const data = await drive.readFile(name)
    if (!data.equals(content)) return new Error(`Read data for ${name} does not match written content.`)
  }

  _validateDirectory (name, list) {
    /*
    let drive = this._validationDrive()
    return new Promise((resolve, reject) => {
      drive.readdir(name, (err, list) => {
        if (err) return reject(err)
        let fileSet = new Set(list)
        for (const file of list) {
          if (!fileSet.has(file)) return reject(new Error(`Directory does not contain expected file: ${file}`))
          fileSet.delete(file)
        }
        if (fileSet.size) return reject(new Error(`Directory contains unexpected files: ${fileSet}`))
        return resolve()
      })
    })
    */
  }

  async _validate () {
    for (const [fileName, content] of this.files) {
      await this._validateFile(fileName, content)
    }
    for (const [dirName, list] of this.directories) {
      await this._validateDirectory(dirName, list)
    }
  }

  async call (ops) {
    let res = await super.call(ops)
    this.log.push(res)
  }

  // START Fuzzing operations

  writeFile () {
    let { name, content } = this._createFile()
    return new Promise((resolve, reject) => {
      this.debug(`Writing file ${name} with content ${content.length}`)
      this.drive.writeFile(name, content, err => {
        if (err) return reject(err)
        this.files.set(name, content)
        return resolve({ type: 'write', name, content })
      })
    })
  }

  deleteFile () {
    let selected = this._selectFile()
    if (!selected) return

    let fileName = selected[0]

    this.debug(`Deleting valid file: ${fileName}`)

    return this._deleteFile(fileName)
  }

  async deleteInvalidFile () {
    let name = this._fileName()
    while (this.files.get(name)) name = this._fileName()
    try {
      this.debug(`Deleting invalid file: ${name}`)
      await this._deleteFile(name)
    } catch (err) {
      if (err && err.code !== 'ENOENT') throw err
    }
  }

  async statFile () {
    let selected = this._selectFile()
    if (!selected) return

    let [fileName, content] = selected
    this.debug(`Statting file: ${fileName}`)
    const st = await this.drive.stat(fileName)
    if (!st) return new Error(`File ${fileName} should exist but does not exist.`)
    if (st.size !== content.length) return new Error(`Incorrect content length for file ${fileName}.`)
    return { type: 'stat', fileName, stat: st }
  }

  async statDirectory () {
    let selected = this._selectDirectory()
    if (!selected) return

    let [dirName, { offset, byteOffset }] = selected

    this.debug(`Statting directory ${dirName}.`)
    const st = await this.drive.stat(dirName)
    if (!st) return new Error(`Directory ${dirName} should exist but does not exist.`)
    if (!st.isDirectory()) return new Error(`Stat for directory ${dirName} does not have directory mode`)
    console.log('st:', st, 'offset:', offset, 'byteOffset:', byteOffset)
    if (st.offset !== offset || st.byteOffset !== byteOffset) return new Error(`Invalid offsets for ${dirName}`)
    this.debug(`  Successfully statted directory.`)
    return { type: 'stat', dirName }
  }

  existingFileOverwrite () {
    let selected = this._selectFile()
    if (!selected) return
    let [fileName] = selected

    let { content: newContent } = this._createFile()

    return new Promise((resolve, reject) => {
      this.debug(`Overwriting existing file: ${fileName}`)
      let writeStream = this.drive.createWriteStream(fileName)
      writeStream.on('error', err => reject(err))
      writeStream.on('finish', () => {
        this.files.set(fileName, newContent)
        resolve()
      })
      writeStream.end(newContent)
    })
  }

  randomReadStream () {
    let selected = this._selectFile()
    if (!selected) return
    let [fileName, content] = selected

    return new Promise((resolve, reject) => {
      let drive = this._validationDrive()
      let start = this.randomInt(content.length)
      let length = this.randomInt(content.length - start)
      this.debug(`Creating random read stream for ${fileName} at start ${start} with length ${length}`)
      let stream = drive.createReadStream(fileName, {
        start,
        length
      })
      collect(stream, (err, bufs) => {
        if (err) return reject(err)
        let buf = bufs.length === 1 ? bufs[0] : Buffer.concat(bufs)

        if (!buf.equals(content.slice(start, start + length))) {
          console.log('buf:', buf, 'content slice:', content.slice(start, start + length))
          return reject(new Error('Read stream does not match content slice.'))
        }
        this.debug(`Random read stream for ${fileName} succeeded.`)
        return resolve()
      })
    })
  }

  async randomStatelessFileDescriptorRead () {
    let selected = this._selectFile()
    if (!selected) return
    let [fileName, content] = selected

    let length = this.randomInt(content.length)
    let start = this.randomInt(content.length)
    let actualLength = Math.min(length, content.length)
    let buf = Buffer.alloc(actualLength)

    let drive = this._validationDrive()
    this.debug(`Random stateless file descriptor read for ${fileName}, ${length} starting at ${start}`)
    const fd = await drive.open(fileName, 'r')

    const bytesRead = await drive.read(fd, buf, 0, length, start)
    buf = buf.slice(0, bytesRead)
    let expected = content.slice(start, start + bytesRead)
    if (!buf.equals(expected)) return new Error('File descriptor read does not match slice.')
    await drive.close(fd)
    this.debug(`Random file descriptor read for ${fileName} succeeded`)
  }

  async createReadableFileDescriptor () {
    let selected = this._selectFile()
    if (!selected) return
    let [fileName, content] = selected

    let start = this.randomInt(content.length / 5)
    let drive = this._validationDrive()

    this.debug(`Creating readable FD for file ${fileName} and start: ${start}`)
    const fd = await drive.open(fileName, 'r')
    this.readable_fds.set(fd, {
      pos: start,
      started: false,
      content
    })
  }

  async randomStatefulFileDescriptorRead () {
    let selected = this._selectReadableFileDescriptor()
    if (!selected) return
    let [fd, fdInfo] = selected

    let { content, pos, started } = fdInfo
    // Try to get multiple reads of of each fd.
    let length = this.randomInt(content.length / APPROX_READS_PER_FD)
    let actualLength = Math.min(length, content.length)
    let buf = Buffer.alloc(actualLength)

    this.debug(`Reading from random stateful FD ${fd}`)

    let self = this

    let drive = this._validationDrive()

    let start = null
    if (!started) {
      fdInfo.started = true
      start = fdInfo.pos
    }

    const bytesRead = await drive.read(fd, buf, 0, length, start)

    if (!bytesRead && length) {
      return close()
    }

    buf = buf.slice(0, bytesRead)
    let expected = content.slice(pos, pos + bytesRead)
    if (!buf.equals(expected)) return new Error('File descriptor read does not match slice.')

    fdInfo.pos += bytesRead

    async function close () {
      await drive.close(fd)
      self.readable_fds.delete(fd)
    }
  }

  async randomStatefulFileDescriptorWrite () {
    let append = !!this.randomInt(1)
    let flags = append ? 'a' : 'w+'

    if (append) {
      let selected = this._selectFile()
      if (!selected) return
      var [fileName, content] = selected
      var pos = content.length
    } else {
      fileName = this._fileName()
      content = Buffer.alloc(0)
      pos = 0
    }

    const bufs = new Array(this.randomInt(APPROX_WRITES_PER_FD - 1)).fill(0).map(() => this._content())
    const self = this

    let count = 0

    this.debug(`Writing stateful file descriptor for fileName ${fileName} with flags ${flags} and buffers ${bufs.length}`)
    const fd = await this.drive.open(fileName, flags)
    if (!bufs.length) return close(fd)
    return writeNext(fd)

    async function writeNext (fd) {
      let next = bufs[count]
      self.debug(`  Writing content with length ${next.length} to FD ${fd} at pos: ${pos}`)
      const bytesWritten = await self.drive.write(fd, next, 0, next.length, pos)
      pos += bytesWritten
      bufs[count] = next.slice(0, bytesWritten)
      if (++count === bufs.length) return close(fd)
      return writeNext(fd)
    }

    async function close (fd) {
      await self.drive.close(fd)
      self.files.set(fileName, Buffer.concat([content, ...bufs]))
    }
  }

  async writeAndMkdir () {
    const self = this

    const { name: fileName, content } = this._createFile()
    const dirName = this._fileName()

    this.debug(`Writing ${fileName} and making dir ${dirName} simultaneously`)

    let pending = 2

    const offset = this.drive._contentFeedLength
    const byteOffset = this.drive._contentFeedByteLength

    const writeStream = this.drive.createWriteStream(fileName)
    writeStream.on('finish', done)

    await this.drive.mkdir(dirName)
    done()
    writeStream.end(content)

    function done (err) {
      if (err) throw err
      if (!--pending) {
        self.files.set(fileName, content)
        self.debug(`Created directory ${dirName}`)
        self.directories.set(dirName, {
          offset,
          byteOffset
        })
      }
    }
  }
}

class SparseHyperdriveFuzzer extends HyperdriveFuzzer {
  async _setup () {
    await super._setup()

    this.remoteDrive = create(this.drive.key, { sparse: true })

    await this.remoteDrive.ready()
    const s1 = this.remoteDrive.replicate({ live: true, encrypt: false })
    s1.pipe(this.drive.replicate({ live: true, encrypt: false })).pipe(s1)
    this.remoteDrive.ready()
  }

  _validationDrive () {
    return this.remoteDrive
  }
}

module.exports = HyperdriveFuzzer

tape('20000 mixed operations, single drive', async t => {
  t.plan(1)

  const fuzz = new HyperdriveFuzzer({
    seed: 'hyperdrive',
    debugging: false
  })

  try {
    await fuzz.run(20000)
    t.pass('fuzzing succeeded')
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('20000 mixed operations, replicating drives', async t => {
  t.plan(1)

  const fuzz = new SparseHyperdriveFuzzer({
    seed: 'hyperdrive2',
    debugging: false
  })

  try {
    await fuzz.run(20000)
    t.pass('fuzzing succeeded')
  } catch (err) {
    t.error(err, 'no error')
  }
})

tape('100 quick validations (initialization timing)', async t => {
  t.plan(1)

  try {
    for (let i = 0; i < 100; i++) {
      const fuzz = new HyperdriveFuzzer({
        seed: 'iteration #' + i,
        debugging: false
      })
      await fuzz.run(100)
    }
    t.pass('fuzzing suceeded')
  } catch (err) {
    t.error(err, 'no error')
  }
})
