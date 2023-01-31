const Autobase = require('autobase')
const Hypercore = require('hypercore')
const fs = require('fs')
const RAM = require('random-access-memory')
const libBased = require('./../index')

function genHC (...args) {
  return new Hypercore(RAM, ...args)
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports.genHC = genHC
module.exports.timeout = timeout

module.exports.genABSet = function (size) {
  const hcs = []
  const ctrls = []
  const bds = []

  for (let i = 0; i < size; i++) {
    const dn = `_hc-${i}`
    fs.rmSync(dn, { recursive: true, force: true })
    hcs.push(genHC())
  }

  for (let i = 0; i < size; i++) {
    ctrls.push(new Autobase({
      inputs: hcs,
      localInput: hcs[i]
    }, { pid: i }))
  }

  for (let i = 0; i < size; i++) {
    bds.push(new libBased.Autobee(ctrls[i], {
      abid: i,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    }))
  }

  return {
    hcs,
    ctrls,
    bds,
    _clear: () => {
    }
  }
}

module.exports.genABSetWithReplica = async function (size) {
  const hcs = []
  const ctrls = []
  const repls = {}
  const bds = []

  for (let i = 0; i < size; i++) {
    const hc = genHC()
    await hc.ready()

    hcs.push(hc)
  }

  for (let i = 0; i < size; i++) {
    const lhcs = []

    for (let y = 0; y < size; y++) {
      const hc = hcs[y]

      if (y === i) {
        lhcs.push(hc)
        continue
      }

      const lhc = genHC(hc.key)
      await lhc.ready()

      const rp0 = hc.replicate(true)
      const rp1 = lhc.replicate(false)

      rp0.pipe(rp1).pipe(rp0)

      repls[`${y}_${i}`] = [rp0, rp1]

      lhcs.push(lhc)
    }

    ctrls.push(new Autobase({
      inputs: lhcs,
      localInput: hcs[i],
      eagerUpdate: true
    }, { pid: i }))
  }

  for (let i = 0; i < size; i++) {
    bds.push(new libBased.Autobee(ctrls[i], {
      abid: i,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    }))
  }

  return {
    hcs,
    ctrls,
    bds,
    repls,
    _clear: () => {
    }
  }
}

async function getVal (bd, k) {
  const data = await bd.get(k)
  return data && data.value
}

module.exports.getVal = getVal

async function printKey (bds, k) {
  for (let i = 0; i < bds.length; i++) {
    console.log(`bd:${i}`, await bds[i].get(k))
  }
}

module.exports.printKey = printKey

async function mTestIs (t, bds, k, v) {
  for (let i = 0; i < bds.length; i++) {
    t.is(await getVal(bds[i], k), v)
  }
}

module.exports.mTestIs = mTestIs
