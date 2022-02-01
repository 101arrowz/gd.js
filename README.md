# gd.js
A tiny, fast, beautiful Geometry Dash API for Node.js and the browser

Installation
---
`npm install gd.js` (or `yarn add gd.js`)

You don't need anything else for modern browser compatibility.
For Node.js, also `npm install node-fetch` (or `yarn add node-fetch`).
For older browsers, also `npm install whatwg-fetch` (or `yarn add whatwg-fetch`) and `require()`/`import` it before `gd.js`. For example:
```js
import 'whatwg-fetch';
import Client from 'gd.js'; // Yay! Compatibility!
```
For both older browsers AND Node.js, `npm install isomorphic-fetch` and `require()`/`import` it before `gd.js`. For example:
```js
require('isomorphic-fetch');
const GD = require('gd.js');
```

Although ECMAScript Modules are used internally, UMD exports are used for compatibility with all platforms. If you want to force ECMAScript Module exports, use `'gd.js/esm'`. Typically, this isn't necessary, as bundlers will automatically use ES Modules if possible.
```js
import GD from 'gd.js/esm';
```

If you want to use a CDN, you can add the following tag to your HTML to create a global `GD` class.
```html
<script src="https://unpkg.com/gd.js"></script>
```

Quickstart
---
[Documentation](#documentation) was a top priority for this project, so it should be excellent. If you use TypeScript or any IDE that can read `.d.ts` files, autocomplete should also be great. That being said, it can be hard to know where to start, so this should act as more of a guide.

`gd.js` exports a single class `Client`, but I like importing it as `GD`. Make sure you've followed all the [additional installation instructions](#installation) regarding `fetch()` as well!
```js
const GD = require('gd.js');
```
ES modules:
```js
import GD from 'gd.js';
```
---
Now you should create an instance of this class to create your client.
```js
const gd = new GD();
```
You can also pass in a configuration to the constructor. This should be an object and can include the following keys:

`logLevel`, which should be one of 0, 1, or 2. 0 = no logging, 1 = warnings, 2 = debug/verbose. 1 by default.

`dbURL`, which should point to the base database URL. Defaults to the official Geometry Dash servers at `http://www.boomlings.com/database` and should only be changed if you are using a private server. Should NOT end with a slash.

`corsURL`, which should point to the base URL for CORS requests. If you're using Node.js, don't worry about this; it only has an impact if you use `gd.js` from a browser. Note that this will be directly prepended to the full request URL, so it will usually end with a trailing slash. **If you are using `gd.js` in the browser, you NEED to set up [your own CORS proxy](#advanced-cors-proxying)**.

`fetch` is the fetch polyfill to use. You can typically just set fetch in the global environment, but if you don't want to do that, you can also pass a polyfill here.

For example:
```js
const gd = new GD({
  logLevel: 0,
  dbURL: 'https://my-custom-server.com/db',
  corsURL: 'https://crossorigin.me/'
})
```

Now you have an instance of the client, which means you can start making requests! Make sure you are connected to the internet and that nothing is blocking requests to the GD server. If you're having issues with `NaN` and `undefined` appearing in your objects, it's probably a network error. To see the raw output for network requests, set `logLevel` to 2.

As of now, the only things you can access are **users** and **levels**. All API methods are asynchronous, so make sure you know how to use `Promise`, `async`/`await` or both!

Quick, self-explanatory examples (detailed info is in autocomplete/documentation website):
```js
const GD = require('gd.js');
const fs = require('fs'); // I'm using Node.js!

const gd = new GD();

const getMyInfo = async () => {
  const me = await gd.users.get('genius991');
  console.log(me.accountID); // 4773829
  console.log(me.userID); // 13083534
  console.log(me.stats.stars); // 1133
  console.log(me.stats.cp); // 0
  console.log(me.cosmetics.colors.primary) // { raw: 9, parsed: '#ff0000' }
  console.log(me.permissions); // { raw: 0, pretty: 'User' }
  const rawIconResponse = await me.cosmetics.renderIcon('cube', true); // Give me the cube icon!
  const dest = fs.createWriteStream('genius991-icon.png');
  rawIconResponse.body.pipe(dest); // Saving the icon to a file! Hell yeah!
  return new Promise((resolve, reject) => {
    rawIconResponse.on('end', () => resolve());
    rawIconResponse.on('error', reject);
  });
}

const getDumbLevels = async () => {
  const extremeDemons = await gd.levels.search({ difficulty: 'Extreme Demon' }, 100);
  const cantLetGo = await gd.levels.search({ query: 'Cant Let Go' });
  const wayTooLong = await gd.levels.search({ length: 'xl' }, 100);
  const tooPopular = await gd.levels.search({ orderBy: 'downloads' }, 100);
  let bloodbath = extremeDemons[0];
  console.log(bloodbath.name); // Bloodbath
  console.log(bloodbath.stats.likes); // 1359617
  bloodbath = await bloodbath.resolve();
  console.log(bloodpath.copy.copyable); // false
  const { raw } = await bloodbath.decodeData();
  // Do whatever you want with the decoded, decompressed raw level string
}

// Every ten minutes, GD Colon will post an account comment saying "I'm actually a furry"
gd.users.login({ username: 'colon', password: 'colonspassword' })
  .then(colon => setInterval(() => colon.postAccountComment("I'm actually a furry"), 60000));
```

Documentation
---
The documentation is available online [here](https://101arrowz.github.io/gd.js). You can click the ["Globals" tab](https://101arrowz.github.io/gd.js/globals) to see all the available classes, types, etc. The client (which is what you get when you import `gd.js`) is available under the ["Client" class](https://101arrowz.github.io/gd.js/classes/client).

Note that everything in the documentation is exported.
```js
// In ESM environments, import utility types and classes as:
import GD, { LevelComment } from 'gd.js';

// In CommonJS environments such as Node.js:
const GD = require('gd.js');
const LevelComment = GD.LevelComment;
```

Do not try to construct the exported utility classes, doing so will always fail. Only construct the `Client` and use it to get instances of the other classes.

### Advanced: Notes About Compatibility

`gd.js` relies on the `fetch` API and `Promise`. Polyfill `Promise` as needed (I recommend [`es6-promise`](https://npmjs.com/package/es6-promise)). For instructions on `fetch` polyfilling, read on.

If you're using `gd.js` in a modern browser, no polyfill is needed. If you're not doing that, you should add a `fetch` polyfill like [`node-fetch`](https://npmjs.com/package/node-fetch) for only Node.js support, [`whatwg-fetch`](https://npmjs.com/package/whatwg-fetch) for only older browser support, or [`isomorphic-fetch`](https://npmjs.com/package/isomorphic-fetch) for both.

Most `fetch` polyfills for old browsers have options to automatically add themselves to the global environment. Once you do that, everything should work.

If you use `gd.js` on Node.js, you'll need to have the `fetch` polyfill added to the `global` object. If you're using `node-fetch` or `isomorphic-fetch` (which automatically installs `node-fetch` anyway), `gd.js` will automatically use it. However, if you're using a `fetch` polyfill that exports the function rather than adding to the global scope, you must make sure `fetch` is explicitly added to the global object. For example:
```js
global.fetch = require('weird-custom-fetch-polyfill');
const gd = require('gd.js'); // Now you can use in Node.js!
```

Beyond `fetch()` issues, note that `gd.js` adds `atob()` and `btoa()` onto the global scope for Node.js environments to mimic their behaviors in the browser.

### Other Info
If you need to parse an arbitrary string with the `key:value:key2:value2` format you can import `'gd.js/esm/util/parse'` and use its `parse` method. (Note this only works with ES Modules; for Node.js, you may need to enable the experimental ESM loader.)

ES Modules:
```js
import { parse } from 'gd.js/esm/util/parse';
```

Its first parameter is the string to parse and its second parameter is the splitter (defaults to `':'`). If you were to parse `kS38` in the level string, you could do:

```js
const levelEasy = await gd.levels.get('Level Easy', true);
const levelEasyData = await levelEasy.decodeData(true);
const colors = levelEasyData.parsed.meta.kS38.split('|').map(str => parse(str, '_'));
```

### Advanced: CORS Proxying

To set up your own CORS proxy, set up a standard [CORS-Anywhere proxy](https://github.com/Rob--W/cors-anywhere), but configure it to strip `User-Agent` and optionally remove the rate limit.

Alternatively you can [deploy this preconfigured template](https://github.com/101arrowz/gd.js-cors-proxy) to a hosting platform of your choice (unfortunately Heroku appears to be blacklisted by RobTop and won't work). Just run `node server.js` with the appropriate `PORT` and `HOST` environment variables and you should be set. Once your server is online, just provide the base path to the server as `corsURL` in the options.

### Development

If you want to contribute, check out the code. Every function, even internal ones, are documented. Thanks for your help!