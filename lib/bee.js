const Hyperbee = require('hyperbee')
const ENC = require('./encoding')
const debug = require('debug')('autobee')

module.exports = {
  build: (core, opts) => {
    return new Hyperbee(core.unwrap(), {
      keyEncoding: 'utf-8',
      extension: false
    })
  },
  apply: applyStrategy,
  ops: {
    put: opPut,
    get: opGet,
    del: opDel
  }
}

async function opPut (key, value, opts) {
  const op = Buffer.from(JSON.stringify({ type: 'put', key, value }))
  return await this.autobase.append(op, opts)
}

async function opDel (key, opts) {
  const op = Buffer.from(JSON.stringify({ type: 'del', key }))
  return await this.autobase.append(op, opts)
}

async function opGet (key) {
  const node = await this.view.get(key)
  if (!node) {
    return null
  }

  const data = {
    seq: node.seq,
    value: ENC.decode(node.value).value
  }

  if (data.key !== undefined) {
    data.key = node.key
  }

  return data
}

const STRATEGIES = {
  'default': applyStrategyDefault
}

async function applyStrategyDefault (b, node, change, clocks, op, opts = {}) {
  debug(`data[${this._abid}]: inVal=${JSON.stringify(op)}`)

  if (op.type === 'put') {
    const incoming = ENC.encode(op.value, change, node.seq)
    await b.put(op.key, Buffer.from(incoming))

  } else if (op.type === 'del') {
    await b.del(op.key)
  }
}


async function applyStrategy (bee, batch, clocks, change, opts = {}) {
  const b = bee.batch({ update: false })

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
