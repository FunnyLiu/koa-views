# koa-views

[![Build status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![NPM downloads][npm-downloads-image]][npm-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]

Template rendering middleware for `koa@2`.

## 源码解析

提供一个render方法挂载到ctx和ctx.response上。

该方法基于getPaths模块，通过模板获取到真实路径。然后如果是html文件，则直接通过koa-send模块进行静态文件处理方式。koa-send底层通过读取文件可读流的方式，将内存挂载到ctx.body上。

如果是模板文件，则通过consolidate模块获取对应模板的render方法，拼接为html后，挂载到ctx.body上。

核心源码如下：

``` js
'use strict'

const { resolve } = require('path')
const debug = require('debug')('koa-views')
const consolidate = require('consolidate')
const send = require('koa-send')
const getPaths = require('get-paths')
const pretty = require('pretty')

module.exports = viewsMiddleware
// koa-views中间件
function viewsMiddleware(
  path,
  { autoRender = true, engineSource = consolidate, extension = 'html', options = {}, map } = {}
) {
  return function views(ctx, next) {
    if (ctx.render) return next()
    // 将render方法挂载到ctx和ctx.response上
    ctx.response.render = ctx.render = function(relPath, locals = {}) {
      // getPaths模块，通过模板获取到真实路径
      return getPaths(path, relPath, extension).then(paths => {
        const suffix = paths.ext
        const state = Object.assign(locals, options, ctx.state || {})
        // deep copy partials
        state.partials = Object.assign({}, options.partials || {})
        debug('render `%s` with %j', paths.rel, state)
        ctx.type = 'text/html'
        // 如果是html文件，直接通过koa-send返回静态资源即可。
        if (isHtml(suffix) && !map) {
          return send(ctx, paths.rel, {
            root: path
          })
        } else {
          // 如果是模板文件
          const engineName = map && map[suffix] ? map[suffix] : suffix
          // 通过consolidate模块获取对应模板的render方法
          const render = engineSource[engineName]

          if (!engineName || !render)
            return Promise.reject(
              new Error(`Engine not found for the ".${suffix}" file extension`)
            )
          //对模板和数据进行整合
          return render(resolve(path, paths.rel), state).then(html => {
            // since pug has deprecated `pretty` option
            // we'll use the `pretty` package in the meanwhile
            if (locals.pretty) {
              debug('using `pretty` package to beautify HTML')
              html = pretty(html)
            }
            // 将拼接后的html挂载到ctx.body上。
            if (autoRender) {
              ctx.body = html
            } else {
              return Promise.resolve(html)
            }
          })
        }
      })
    }

    return next()
  }
}

function isHtml(ext) {
  return ext === 'html'
}

```

## Installation

```sh
npm install koa-views
```

## Templating engines

`koa-views` is using [consolidate](https://github.com/tj/consolidate.js) under the hood.

[List of supported engines](https://github.com/tj/consolidate.js#supported-template-engines)

**NOTE**: you must still install the engines you wish to use, add them to your package.json dependencies.

## Example

```js
var views = require('koa-views');

// Must be used before any router is used
app.use(views(__dirname + '/views', {
  map: {
    html: 'underscore'
  }
}));

app.use(async function (ctx) {
  ctx.state = {
    session: this.session,
    title: 'app'
  };

  await ctx.render('user', {
    user: 'John'
  });
});
```

For more examples you can take a look at the [tests](./test/index.js).

## Simple middleware

If you need to simply render pages with locals, you can install `koa-views-render`:

```sh
npm install koa-views-render
```

Then simply use it on your routes and its arguments will be passed to `ctx.render`.

```js
var render = require('koa-views-render');

// ...

app.use(render('home', { title : 'Home Page' }));
```

## API

#### `views(root, opts)`

* `root`: Where your views are located. Must be an absolute path. All rendered views are relative to this path
* `opts` (optional)

* `opts.autoRender`: Whether to use `ctx.body` to receive the rendered template string. Defaults to `true`.

```js
app.use(views(__dirname, { autoRender: false, extension: 'pug' }))

app.use(async function (ctx) {
  return await ctx.render('user.pug')
})
```

vs.

```js
app.use(views(__dirname, { extension: 'pug' }))

app.use(async function (ctx) {
  await ctx.render('user.pug')
})
```

* `opts.extension`: Default extension for your views

Instead of providing the full file extension you can omit it.
```js
app.use(async function (ctx) {
  await ctx.render('user.pug')
})
```

vs.

```js
app.use(views(__dirname, { extension: 'pug' }))

app.use(async function (ctx) {
  await ctx.render('user')
})
```

* `opts.map`: Map a file extension to an engine

In this example, each file ending with `.html` will get rendered using the `nunjucks` templating engine.
```js
app.use(views(__dirname, { map: {html: 'nunjucks' }}))

// render `user.html` with nunjucks
app.use(async function (ctx) {
  await ctx.render('user.html')
})
```

* `opts.engineSource`: replace consolidate as default engine source

If you’re not happy with consolidate or want more control over the engines, you can override it with this options. `engineSource` should
be an object that maps an extension to a function that receives a path and options and returns a promise. In this example templates with the `foo` extension will always return `bar`.

```js
app.use(views(__dirname, { engineSource: {foo: () => Promise.resolve('bar')}}))

app.use(async function (ctx) {
  await ctx.render('index.foo')
})
```

* `opts.options`: These options will get passed to the view engine. This is the time to add `partials` and `helpers` etc.

```js
const app = new Koa()
  .use(views(__dirname, {
    map: { hbs: 'handlebars' },
    options: {
      helpers: {
        uppercase: (str) => str.toUpperCase()
      },

      partials: {
        subTitle: './my-partial' // requires ./my-partial.hbs
      },
      
      cache: true // cache the template string or not
    }
  }))
  .use(function (ctx) {
    ctx.state = { title: 'my title', author: 'queckezz' }
    return ctx.render('./my-view.hbs')
  })
```

## Debug

Set the `DEBUG` environment variable to `koa-views` when starting your server.

```bash
$ DEBUG=koa-views
```

## License

[MIT](./license)

[travis-image]: https://img.shields.io/travis/queckezz/koa-views.svg?style=flat-square
[travis-url]: https://travis-ci.org/queckezz/koa-views
[npm-image]: https://img.shields.io/npm/v/koa-views.svg?style=flat-square
[npm-downloads-image]: https://img.shields.io/npm/dm/koa-views.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-views
[david-image]: http://img.shields.io/david/queckezz/koa-views.svg?style=flat-square
[david-url]: https://david-dm.org/queckezz/koa-views
[license-image]: http://img.shields.io/npm/l/koa-views.svg?style=flat-square
[license-url]: ./license
