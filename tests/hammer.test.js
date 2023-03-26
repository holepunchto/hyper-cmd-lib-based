const test = require('brittle')
const utils = require('./utils')

test.solo('basic random repeated', { timeout: 3600 * 1000 }, async function (tt) {
  const count = 3
  const { bds, repls, _clear } = await utils.genABSetWithReplica(3, 'kv')

  while (true) {
    console.time('loop')
    let exp = null

    for (let i = 0; i < 100; i++) {
      const rix = Math.floor((Math.random() * 1000000) % count)
      exp = `bar[${rix}]`
      await bds[rix].put('foo', exp)
    }

    await bds[0].put('foo', exp)

    await utils.timeout(100)

    await utils.mTestIs(tt, bds, 'foo', exp)
    console.timeEnd('loop')
  }

  t.pass()
})
