const Autobase = require('autobase')
const Hypercore = require('hypercore')
const libBased = require('./index')

const db0 = genDB('db0')
const db1 = genDB('db1')

function genDB (name) {
  return new Hypercore(name)
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const ctrl0 = new Autobase({
  inputs: [db0, db1],
  localInput: db0
}, { pid: 0 })

const ctrl1 = new Autobase({
  inputs: [db0, db1],
  localInput: db1
}, { pid: 1 })

const bfs0 = new libBased.Autobee(ctrl0, {
  abid: 0,
  keyEncoding: 'utf-8',
  valueEncoding: 'binary'
})

const bfs1 = new libBased.Autobee(ctrl1, {
  abid: 1,
  keyEncoding: 'utf-8',
  valueEncoding: 'binary'
})

async function print () {
  console.log('bfs0', await bfs0.get('foo'))
  console.log('bfs1', await bfs1.get('foo'))
}

setTimeout(async () => {
  await timeout(1000)

  console.log('\n\n\n\n\n')

  await bfs1.put('foo', 'bar[0]')
  await bfs0.put('foo', 'bar[0]')

  await timeout(1000)
  await print()

  await timeout(1000)
  await bfs1.del('foo')

  await timeout(1000)
  await print()
}, 1000)
