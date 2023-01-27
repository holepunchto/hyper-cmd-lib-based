const test = require('brittle')
const utils = require('./utils')

test('basic', async tt => {
  const { hcs, ctrls, bsds, _clear } = utils.genABSet(2)

  async function print () {
    console.log('bfs0', await bsds[0].get('foo'))
    console.log('bfs1', await bsds[1].get('foo'))
  }

  await utils.timeout(1000)

  await bsds[1].put('foo', 'bar[0]')
  await bsds[0].put('foo', 'bar[0]')

  await utils.timeout(1000)
  await print()

  await utils.timeout(1000)
  await bsds[1].del('foo')

  await utils.timeout(1000)
  await print()

  tt.teardown(_clear)

  tt.pass()
})
