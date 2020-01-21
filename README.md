# gd.js
A Geometry Dash API for Node.js and the browser

## Installation
`npm install gd.js` (or `yarn add gd.js`)

## Setup

TL;DR: Install `node-fetch` if you're using Node.js with this library. Install `whatwg-fetch` if you're using older browsers with this library. Install `isomorphic-fetch` if you're using both. Don't install anything if you're using only modern browsers.

---

`gd.js` relies on the `fetch` API and `Promise`. Polyfill `Promise` as needed (I recommend [`es6-promise`](https://npmjs.com/package/es6-promise)). For instructions on `fetch` polyfilling, read on.

If you're using `gd.js` in a modern browser, no polyfill is needed. If you're not doing that, you should add a `fetch` polyfill like [`node-fetch`](https://npmjs.com/package/node-fetch) for only Node.js support, [`whatwg-fetch`](https://npmjs.com/package/whatwg-fetch) for only older browser support, or [`isomorphic-fetch`](https://npmjs.com/package/isomorphic-fetch) for both.

Most `fetch` polyfills for old browsers have options to automatically add themselves to the global environment. Once you do that, everything should work.

If you use `gd.js` on Node.js, you'll need to have the `fetch` polyfill added to the `global` object. If you're using `node-fetch` or `isomorphic-fetch` (which automatically installs `node-fetch` anyway), `gd.js` will automatically use it. However, if you're using a `fetch` polyfill that exports the function rather than adding to the global scope, you must make sure `fetch` is explicitly added to the global object. For example:
```js
globals.fetch = require('weird-custom-fetch-polyfill');
const gd = require('gd.js'); // Now you can use in Node.js!
```

## Documentation
Coming Soon