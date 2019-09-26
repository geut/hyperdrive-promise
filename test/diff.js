const t = require('tape')
const _tape = require('tape-promise').default
const tape = _tape(t)
const create = require('./helpers/create')

tape('simple diff stream', async function (t) {
  const drive = create()

  var v1, v2, v3

  // TODO: The v3 diff currently has a false-positive for put-other.
  const v3Diff = ['del-hello', 'put-other']
  // Since hello was already written in v2, its corresponding delete should be recorded in v2diff.
  const v2Diff = ['put-other', 'del-hello']
  // Since hello has been put/deleted, it does not appear in the complete diff.
  const v1Diff = ['put-other']

  await writeVersions()
  await verifyDiffStream(t, drive, [v1], v1Diff)
  await verifyDiffStream(t, drive, [v2], v2Diff)
  await verifyDiffStream(t, drive, [v3], v3Diff)
  t.end()

  async function writeVersions () {
    try {
      await drive.ready()
      v1 = drive.version
      await drive.writeFile('/hello', 'world')
      v2 = drive.version
      await drive.writeFile('/other', 'file')
      v3 = drive.version
      return await drive.unlink('/hello')
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

tape('diff stream with mounts', async function (t) {
  const drive1 = create()
  const drive2 = create()
  const drive3 = create()

  var v1, v2, v3

  const v3Diff = ['unmount-hello', 'mount-goodbye']
  const v2Diff = ['mount-hello', 'put-other']
  const v1Diff = ['mount-goodbye', 'put-other']

  await Promise.all([
    drive1.ready(),
    drive2.ready(),
    drive3.ready()
  ]).catch(err => {
    t.error(err, 'no error')
  })

  await writeVersions()
  await verifyDiffStream(t, drive1, [v1], v1Diff)
  await verifyDiffStream(t, drive1, [v1, v2], v2Diff)
  await verifyDiffStream(t, drive1, [v2, v3], v3Diff)
  t.end()

  async function writeVersions () {
    v1 = drive1.version
    try {
      await drive1.mount('/hello', drive2.key)
      await drive1.writeFile('/other', 'file')
      v2 = drive1.version
      await drive1.mount('/goodbye', drive3.key)
      await drive1.unmount('/hello')
      v3 = drive1.version
      return
    } catch (err) {
      t.error(err, 'no error')
    }
  }
})

async function verifyDiffStream (t, drive, [from, to], diffList) {
  const diffSet = new Set(diffList)

  const fromDrive = from ? drive.checkout(from) : drive
  const toDrive = to ? drive.checkout(to) : drive
  const diffStream = toDrive.createDiffStream(fromDrive)

  return new Promise(resolve => {
    diffStream.on('data', ({ type, name }) => {
      const key = `${type}-${name}`
      if (!diffSet.has(key)) {
        return t.fail('an incorrect diff was streamed')
      }
      diffSet.delete(key)
    })
    diffStream.on('end', () => {
      t.same(diffSet.size, 0)
      return resolve()
    })
  })
}
