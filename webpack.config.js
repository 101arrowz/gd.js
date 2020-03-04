const TerserPlugin = require('terser-webpack-plugin');
const { join } = require('path');
module.exports = {
  mode: 'production',
  entry: './src/entry.ts',
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
  },
  output: {
    library: 'GD',
    libraryTarget: 'umd',
    globalObject: 'typeof self !== \'undefined\' ? self : this',
    filename: 'index.js',
    path: join(__dirname, 'lib/')
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.d.ts', '.js', '.json']
  },
  target: 'web',
  externals: {
    util: 'commonjs2 util',
    'node-fetch': 'commonjs2 node-fetch',
    'duration-converter': 'commonjs2 duration-converter'
  },
  node: false
}