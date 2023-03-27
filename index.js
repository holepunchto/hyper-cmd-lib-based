const Autobase = require('autobase')
const Hyperbee = require('hyperbee')
const Hypercore = require('hypercore')
const debug = require('debug')('autobee')

module.exports.Autobased = class Autobee {
  constructor (autobase, opts = {}) {
    this.opts = opts
    this.type = opts.type || 'log'

    this.autobase = autobase || new Autobase({
      inputs: opts.inputs,
      localInput: opts.localInput,
      localOutput: opts.localOutput,
      eagerUpdate: opts.eagerUpdate
    })

    this._abid = opts.abid !== undefined
      ? opts.abid
      : Math.ceil(Math.random() * 100000)

    this.autobase.start({
      unwrap: true,
      apply: async (struct, batch, clocks, change) => {
        if (this.type === 'kv') {
          return await applyKvBatch.call(this, struct, batch, clocks, change, {
            applyStrategy: opts.applyStrategy
          })
        }

        return await applyLogBatch.call(this, struct, batch, clocks, change, {
          applyStrategy: opts.applyStrategy
        })
      },
      view: core => {
        core.on('truncate', x => {
          ++this.truncateCnt
        })

        if (this.type === 'kv') {
          return new Hyperbee(core.unwrap(), {
            keyEncoding: 'utf-8',
            extension: false
          })
        }

        return core
      }
    })

    this.view = this.autobase.view
  }

  ready () {
    return this.autobase.ready()
  }

  async append (value, opts) {
    if (this.type !== 'log') {
      throw new Error('PUT: operation not allowed')
    }

    const op = Buffer.from(JSON.stringify({ type: 'put', value }))
    return await this.autobase.append(op, opts)
  }

  async put (key, value, opts) {
    if (this.type !== 'kv') {
      throw new Error('PUT: operation not allowed')
    }

    const op = Buffer.from(JSON.stringify({ type: 'put', key, value }))
    return await this.autobase.append(op, opts)
  }

  async del (key, opts) {
    if (this.type !== 'kv') {
      throw new Error('DEL: operation not allowed')
    }

    const op = Buffer.from(JSON.stringify({ type: 'del', key }))
    return await this.autobase.append(op, opts)
  }

  async get (key) {
    if (this.type === 'log') {
      await this.view.update()

      if (!this.view.length) {
        return null
      }
    }

    const node = await this.view.get(key)
    if (!node) {
      return null
    }

    const data = {
      seq: node.seq,
      value: decode(node.value).value
    }

    if (data.key !== undefined) {
      data.key = node.key
    }

    return data
  }

  async len () {
    await this.view.update()

    return this.view.length
  }
}

async function applyKvBatch (bee, batch, clocks, change, opts = {}) {
  const b = bee.batch({ update: false })

  for (const node of batch) {
    const val = node.value.toString()
    let op = null

    try {
      op = JSON.parse(val)
    } catch (e) {
      continue
    }

    const strategy = opts.applyStrategy || 'default-kv'

    if (typeof strategy === 'string') {
      if (STRATEGIES[strategy]) {
        await STRATEGIES[strategy].call(this, b, node, change, clocks, op, {})
      } else {
        throw new Error('Autobased: strategy not found')
      }
    } else if (typeof strategy === 'function') {
      await opts.applyStrategy.call(this, b, node, change, clocks, op, {})
    } else {
      throw new Error('Autobased: strategy not found')
    }
  }

  return await b.flush()
}

async function applyLogBatch (core, batch, clocks, change, opts = {}) {
  for (const node of batch) {
    const val = node.value.toString()
    let op = null

    try {
      op = JSON.parse(val)
    } catch (e) {
      continue
    }

    const strategy = opts.applyStrategy || 'default-log'

    if (typeof strategy === 'string') {
      if (STRATEGIES[strategy]) {
        await STRATEGIES[strategy].call(this, core, node, change, clocks, op, {})
      } else {
        throw new Error('Autobased: strategy not found')
      }
    } else if (typeof strategy === 'function') {
      await opts.applyLogStrategy.call(this, core, node, change, clocks, op, {})
    } else {
      throw new Error('Autobased: strategy not found')
    }
  }
}

const STRATEGIES = {
  'default-log': applyStrategyDefaultLog,
  'default-kv': applyStrategyDefaultKv,
  'local-kv': applyStrategyLocalKv
}

async function applyStrategyDefaultKv (b, node, change, clocks, op, opts = {}) {
  debug(`data[${this._abid}]: inVal=${JSON.stringify(op)}`)

  if (op.type === 'put') {
    const incoming = encode(op.value, change, node.seq)
    await b.put(op.key, Buffer.from(incoming))

  } else if (op.type === 'del') {
    await b.del(op.key)
  }
}

async function applyStrategyDefaultLog (core, node, change, clocks, op, opts = {}) {
  debug(`data[${this._abid}]: inVal=${JSON.stringify(op)}`)

  const incoming = encode(op.value, change, node.seq)
  core.append(Buffer.from(incoming))
}

function isLocalWinner (clock, change, seq) {
  return clock.has(change) && (clock.get(change) >= seq)
}

async function applyStrategyLocalKv (b, node, change, clocks, op, opts = {}) {
  const localClock = clocks.local

  if (op.type === 'put') {
    const existing = await b.get(op.key, { update: false })
    const incoming = encode(op.value, change, node.seq)

    await b.put(op.key, Buffer.from(incoming))

    if (!existing) {
      return
    }

    await handleConflict.call(this, op.type, op.key, incoming, existing.value)
  } else if (op.type === 'del') {
    await b.del(op.key)
  }

  async function handleConflict (type, key, incoming, existing) {
    const inVal = decode(incoming)
    const exVal = decode(existing)

    if (inVal.value === exVal.value) {
      return
    }

    debug(`conflict[${this._abid}]: inVal=${JSON.stringify(inVal)}, exVal=${JSON.stringify(exVal)}`)
    const { change: existingChange, seq: existingSeq } = exVal

    if (isLocalWinner(localClock, existingChange, existingSeq)) {
      await b.put(key, Buffer.from(existing))
    }
  }
}

function encode (value, change, seq) {
  return JSON.stringify({ value, change: change.toString('hex'), seq })
}

function decode (raw) {
  return JSON.parse(raw)
}

module.exports.decode = decode
module.exports.encode = decode
