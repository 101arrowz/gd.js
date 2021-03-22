const { default: GD, ...rest } = require('.');

for (const k in rest) GD[k] = rest[k];

module.exports = GD;
