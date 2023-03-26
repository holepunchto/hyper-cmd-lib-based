const test = require('brittle')
const utils = require('./utils')

async function basicLog (tt, il = true) {
  const { bds, _clear } = il
    ? utils.genABSet(5, 'log')
    : await utils.genABSetWithReplica(5, 'log')

  await bds[1].append('bar[1]')
  await bds[0].append('bar[0]')

  await utils.timeout(1)

  // await utils.printLogLen(bds)
  await utils.mTestLenIs(tt, bds, 2)
  await utils.mTestIs(tt, bds, 0, 'bar[1]')
  await utils.mTestIs(tt, bds, 1, 'bar[0]')

  tt.teardown(_clear)
  tt.pass()
}

test('basic-log', basicLog)

async function basicKV (tt, il = true) {
  const { bds, _clear } = il
    ? utils.genABSet(5, 'kv')
    : await utils.genABSetWithReplica(5, 'kv')

  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')

  await utils.mTestIs(tt, bds, 'foo', 'bar[0]')

  // await utils.printKvKey(bds, 'foo')

  await bds[1].del('foo')

  if (!il) await utils.timeout(1)

  await utils.mTestIs(tt, bds, 'foo', null)

  tt.teardown(_clear)
  tt.pass()
}

test('basic-kv', basicKV)
test('basic-kv (replica)', tt => basicKV(tt, false))

async function basicKVRand (tt, il = true) {
  const cnt = 10
  const { bds, _clear } = il
    ? utils.genABSet(cnt, 'kv')
    : await utils.genABSetWithReplica(cnt, 'kv')

  let exp = null

  for (let i = 0; i < 100; i++) {
    const rix = Math.floor((Math.random() * 1000000) % cnt)
    exp = `bar[${rix}]`
    await bds[rix].put('foo', exp)
  }

  await bds[0].put('foo', exp)

  if (!il) await utils.timeout(100)

  await utils.mTestIs(tt, bds, 'foo', exp)

  tt.teardown(_clear)
  tt.pass()
}

test('basic-kv / random value', basicKVRand)
test('basic-kv / random value (replica)', tt => basicKVRand(tt, false))

test('basic-kv / stream pause (replica)', async tt => {
  const { bds, repls, _clear } = await utils.genABSetWithReplica(3, 'kv')

  await bds[0].put('foo', 'bar[0]')
  await bds[1].put('foo', 'bar[1]')
  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')
  await bds[0].put('foo', 'bar[0]') // incr clock last time

  await utils.mTestIs(tt, bds, 'foo', 'bar[0]')

  repls['0_1'][0].noiseStream.pause()
  repls['0_2'][0].noiseStream.pause()

  await bds[0].del('foo')

  await utils.mTestIs(tt, [bds[0]], 'foo', null)
  await utils.mTestIs(tt, [bds[1]], 'foo', 'bar[0]')
  await utils.mTestIs(tt, [bds[2]], 'foo', 'bar[0]')

  repls['0_1'][0].noiseStream.resume()
  repls['0_2'][0].noiseStream.resume()

  await utils.mTestIs(tt, bds, 'foo', null)

  tt.teardown(_clear)
  tt.pass()
})

async function basicKVAddInput (tt) {
  const { bds, _clear, _addInput } = utils.genABSet(3, 'kv')

  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')

  await utils.mTestIs(tt, bds, 'foo', 'bar[0]')

  await  _addInput()
  await  _addInput()

  await utils.mTestIs(tt, bds, 'foo', 'bar[0]')

  await bds[1].del('foo')

  await utils.mTestIs(tt, bds, 'foo', null)

  tt.teardown(_clear)
  tt.pass()
}

test('basic-kv / add new input', basicKVAddInput)
