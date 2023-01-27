const test = require('brittle')
const utils = require('./utils')

test('basic', async tt => {
  const { hcs, ctrls, bds, _clear } = utils.genABSet(2)

  await utils.timeout(100)

  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')

  await utils.timeout(100)

  tt.is(await utils.getVal(bds[0], 'foo'), 'bar[0]')
  tt.is(await utils.getVal(bds[1], 'foo'), 'bar[0]')

  // utils.printKey(bds, 'foo')

  await utils.timeout(100)

  await bds[1].del('foo')

  await utils.timeout(100)

  tt.is(await utils.getVal(bds[0], 'foo'), null)
  tt.is(await utils.getVal(bds[1], 'foo'), null)

  tt.teardown(_clear)

  tt.pass()
})
