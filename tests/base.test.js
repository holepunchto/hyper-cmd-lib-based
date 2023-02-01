const test = require('brittle')
const utils = require('./utils')

async function basic (tt, il = true) {
  const { bds, _clear } = il
    ? utils.genABSet(5)
    : await utils.genABSetWithReplica(5)

  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')

  await utils.mTestIs(tt, bds, 'foo', 'bar[0]')

  // utils.printKey(bds, 'foo')

  await bds[1].del('foo')

  if (!il) await utils.timeout(1)

  await utils.mTestIs(tt, bds, 'foo', null)

  tt.teardown(_clear)
  tt.pass()
}

test('basic', basic)
test('basic (replica)', tt => basic(tt, false))

async function basicRand (tt, il = true) {
  const cnt = 10
  const { bds, _clear } = il
    ? utils.genABSet(cnt)
    : await utils.genABSetWithReplica(cnt)

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

test('basic / random value', basicRand)
test('basic / random value (replica)', tt => basicRand(tt, false))

test('basic / stream pause (replica)', async tt => {
  const { bds, repls, _clear } = await utils.genABSetWithReplica(3)

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
