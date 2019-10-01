# hyperdrive-promise

An async/await based wrapper for [hyperdrive](https://github.com/mafintosh/hyperdrive) (v10+)

[![Build Status](https://travis-ci.com/geut/hyperdrive-promise.svg?branch=master)](https://travis-ci.com/geut/hyperdrive-promise)

## Install

```
$ npm install @geut/hyperdrive-promise
```

## Usage

`hyperdrive-promise` its totally [API compatible](https://github.com/mafintosh/hyperdrive#api) with hyperdrive v10+. It's only a promise based wrapper.

E.g.:

```javascript
const hyperdrive = require('hyperdrive-promise')
const archive = hyperdrive('./my-first-hyperdrive') // content will be stored in this folder

try {
  await archive.writeFile('/hello.txt', 'world')
  const list = await archive.readdir('/')
  console.log(list) // prints ['hello.txt']
  const data = await archive.readFile('/hello.txt', 'utf-8')
  console.log(data) // prints 'world'
} catch (err) {
  console.log(err)
  // deal with the err
}

```

### Considerations

`hyperdrive` originally combines a callback (`cb`) based API with an event
emitter (`EE`). While in most cases it is quite simple to translate from
`cb`s to `Promise`s, this is not true for **event emitters**. In such
situations we decided to return an `EE` and minimize the effect of async/await. See for example the `download`
API below.

#### download

In `hyperdrive`, the download API has both a callback called on
_completion_ and event emitter for watching progress.

Let's consider the following download action:
```javascript
const handle = drive.download('hello', { detailed: true })
handle.on('finish', (total, byFile) => {
  console.log(total.downloadedBlocks)
  console.log(total.downloadedBytes)
  console.log(byFile.get('hello').downloadedBlocks)
})
handle.on('error', console.error)
```


To maintain the same functionality the above mechanism translates to the following in
`hyperdrive-promise`:

```javascript
try {
  const [ total, byFile ] = await drive.download('hello', { detailed: true })
  console.log(total.downloadedBlocks)
  console.log(total.downloadedBytes)
  console.log(byFile.get('hello').downloadedBlocks)
} catch (err) {
  // deal with download err
}
```

As you can see, we can only `await` the `'finish'` event. If you need to use other events you should use the regular `EE` API.

## Contributing

:busts_in_silhouette: Ideas and contributions to the project are welcome. You must follow this [guideline](https://github.com/geut/hyperdrive-promise/blob/master/CONTRIBUTING.md).


## Sponsored By
[
<img src="https://libscie.org/assets/images/image01.png?v88639115589651" alt="Liberate Science" width="350px" />
](https://libscie.org)
