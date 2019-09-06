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
