const Autobase = require('autobase')
const Hypercore = require('hypercore')
const fs = require('fs')
const libBased = require('./../index')

function genHC (name) {
  return new Hypercore(name)
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
    hcs.push(genHC(dn))
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
      for (let i = 0; i < size; i++) {
        const dn = `_hc-${i}`
        fs.rmSync(dn, { recursive: true, force: true })
      }
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
