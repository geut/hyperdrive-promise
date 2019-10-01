# hyperpromise

An async/await based wrapper for [hyperdrive](https://github.com/mafintosh/hyperdrive) (v10+)

[![Build Status](https://travis-ci.com/geut/hyperpromise.svg?branch=master)](https://travis-ci.com/geut/hyperpromise)

## Install

```
$ npm install @geut/hyperpromise
```

## Usage

`hyperpromise` its totally [API compatible](https://github.com/mafintosh/hyperdrive#api) with hyperdrive v10+. It's only a promise based wrapper.

E.g.:

```javascript
const hyperpromise = require('hyperpromise')
const archive = hyperpromise('./my-first-hyperdrive') // content will be stored in this folder

try {
  await archive.writeFile('/hello.txt', 'world')
  const list= await archive.readdir('/')
  console.log(list) // prints ['hello.txt']
  const data = await archive.readFile('/hello.txt', 'utf-8')
  console.log(data) // prints 'world'
} catch (err) {
  console.log(err)
  // deal with the err
}

```

## Contributing

:busts_in_silhouette: Ideas and contributions to the project are welcome. You must follow this [guideline](https://github.com/geut/hyperpromise/blob/master/CONTRIBUTING.md).


## Sponsored By
[
<img src="https://libscie.org/assets/images/image01.png?v88639115589651" alt="Liberate Science" width="350px" />
](https://libscie.org)
