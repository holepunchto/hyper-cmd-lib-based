const Autobase = require('autobase')
const ENC = require('./lib/encoding')
const debug = require('debug')('autobee')

const HANDLER = {
  bee: require('./lib/bee'),
  log: require('./lib/log')
}

module.exports.Autobased = class Autobee {
  constructor (autobase, opts = {}) {
    if (!HANDLER[opts.type]) {
      throw new Error('ERR_STRUCT_INVALID')
    }

    this.opts = opts
    this.type = opts.type
    this.hndl = HANDLER[this.type]

    for (const [k, m] of Object.entries(this.hndl.ops)) {
      this[k] = m.bind(this)
    }

    this.autobase = autobase || new Autobase({
      inputs: opts.inputs,
      localInput: opts.localInput,
      localOutput: opts.localOutput,
      eagerUpdate: opts.eagerUpdate
    })

    this.autobase.start({
      unwrap: true,
      apply: async (struct, batch, clocks, change) => {
        const apply = this.hndl.apply.bind(this)
        return apply(struct, batch, clocks, change, {
          applyStrategy: opts.applyStrategy
        })
      },
      view: core => {
        core.on('truncate', x => {
          ++this.truncateCnt
        })

        return this.hndl.build(core, this.opts)
      }
    })

    this.view = this.autobase.view
  }

  ready () {
    return this.autobase.ready()
  }
}
