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
  const bsds = []

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
    bsds.push(new libBased.Autobee(ctrls[i], {
      abid: i,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    }))
  }

  return {
    hcs,
    ctrls,
    bsds,
    _clear: () => {
      for (let i = 0; i < size; i++) {
        const dn = `_hc-${i}`
        fs.rmSync(dn, { recursive: true, force: true })
      }
    }
  }
}
