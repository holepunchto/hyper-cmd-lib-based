const Hypercore = require('hypercore')
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

module.exports.genABSet = function (size, type) {
  const hcs = []
  const bds = []

  for (let i = 0; i < size; i++) {
    hcs.push(genHC())
  }

  for (let i = 0; i < size; i++) {
    bds.push(new libBased.Autobased(null, {
      type: type,
      storage: RAM,
      inputs: [...hcs],
      localInput: hcs[i],
      abid: i,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    }))
  }

  return {
    hcs,
    bds,
    _clear: () => {
    },
    _addInput: async () => {
      const hc = genHC()
      hcs.push(hc)

      for (let i = 0; i < size; i++) {
        const bd = bds[i]
        await bd.autobase.addInput(hc)
      }

      size++

      bds.push(new libBased.Autobased(null, {
        type: 'kv',
        inputs: [...hcs],
        localInput: hc,
        abid: size - 1
      }))
    }
  }
}

module.exports.genABSetWithReplica = async function (size, type) {
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

    bds.push(new libBased.Autobased(null, {
      type: type,
      inputs: lhcs,
      localInput: hcs[i],
      abid: i
    }))
  }

  return {
    hcs,
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

async function printKvKey (bds, k) {
  for (let i = 0; i < bds.length; i++) {
    console.log(`bd:${i}`, await bds[i].get(k))
  }
}

module.exports.printKvKey = printKvKey

async function printLogLen (bds, k) {
  for (let i = 0; i < bds.length; i++) {
    console.log(`bd:${i}`, await bds[i].len())
  }
}

module.exports.printLogLen = printLogLen

async function mTestIs (t, bds, k, v) {
  for (let i = 0; i < bds.length; i++) {
    t.is(await getVal(bds[i], k), v)
  }
}

module.exports.mTestIs = mTestIs

async function mTestLenIs (t, bds, len) {
  for (let i = 0; i < bds.length; i++) {
    t.is(await bds[i].len(), len)
  }
}

module.exports.mTestLenIs = mTestLenIs
