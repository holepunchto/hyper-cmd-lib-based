const test = require('brittle')
const utils = require('./utils')

test('basic', async tt => {
  const { hcs, ctrls, bds, _clear } = utils.genABSet(2)

  await bds[1].put('foo', 'bar[1]')
  await bds[0].put('foo', 'bar[0]')

  tt.is(await utils.getVal(bds[0], 'foo'), 'bar[0]')
  tt.is(await utils.getVal(bds[1], 'foo'), 'bar[0]')

  // utils.printKey(bds, 'foo')

  await bds[1].del('foo')

  await utils.mTestIs(tt, bds, 'foo', null)

  tt.teardown(_clear)

  tt.pass()
})
