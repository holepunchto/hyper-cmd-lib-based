function encode (value, change, seq) {
  return JSON.stringify({ value, change: change.toString('hex'), seq })
}

function decode (raw) {
  return JSON.parse(raw)
}

module.exports.decode = decode
module.exports.encode = encode
