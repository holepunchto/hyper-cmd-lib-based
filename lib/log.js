const Hypercore = require('hypercore')
const ENC = require('./encoding')
const debug = require('debug')('autobee')

module.exports = {
  build: (core, opts) => {
    return core
  },
  apply: applyStrategy,
  ops: {
    append: opAppend,
    get: opGet,
    len: opLen
  }
}

async function opLen () {
  await this.view.update()

  return this.view.length
}

async function opAppend (value, opts) {
  if (this.type !== 'log') {
    throw new Error('PUT: operation not allowed')
  }

  const op = Buffer.from(JSON.stringify({ type: 'put', value }))
  return await this.autobase.append(op, opts)
}

async function opGet (key) {
  await this.view.update()

  if (!this.view.length) {
    return null
  }

  const node = await this.view.get(key)
  if (!node) {
    return null
  }

  const data = {
    seq: node.seq,
    value: ENC.decode(node.value).value
  }

  return data
}

const STRATEGIES = {
  'default': applyStrategyDefault
}

async function applyStrategyDefault (core, node, change, clocks, op, opts = {}) {
  debug(`data[${this._abid}]: inVal=${JSON.stringify(op)}`)

  const incoming = ENC.encode(op.value, change, node.seq)
  core.append(Buffer.from(incoming))
}

async function applyStrategy (core, batch, clocks, change, opts = {}) {
  for (const node of batch) {
    const val = node.value.toString()
    let op = null

    try {
      op = JSON.parse(val)
    } catch (e) {
      continue
    }

    const strategy = opts.applyStrategy || 'default'

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
