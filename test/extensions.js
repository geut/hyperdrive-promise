const tape = require('tape')
const create = require('./helpers/create')

const EXAMPLE_TYPE = 'example'
const EXTENSIONS = [EXAMPLE_TYPE]
const EXAMPLE_MESSAGE = Buffer.from([4, 20])

tape('send and receive extension messages', async t => {
  var drive1 = create(null, {
    extensions: EXTENSIONS
  })

  try {
    await drive1.ready()
    t.plan(3)

    var drive2 = create(drive1.key, {
      extensions: EXTENSIONS
    })

    await drive2.ready()
    const replicate1 = drive1.replicate()
    const replicate2 = drive2.replicate()

    drive2.on('extension', function (type, message) {
      t.equal(type, EXAMPLE_TYPE, 'got expected type')
      t.equal(message.toString('hex'), EXAMPLE_MESSAGE.toString('hex'), 'got expected message')
    })

    drive1.on('peer-add', function () {
      t.pass('got peer add event')
      drive1.extension(EXAMPLE_TYPE, EXAMPLE_MESSAGE)
    })

    replicate1.pipe(replicate2).pipe(replicate1)
  } catch (err) {
    t.error(err, 'no error')
  }
})
