process.env.NX_TASK_TARGET_PROJECT ||= 'recommendation-service';
process.env.NX_TASK_TARGET_TARGET ||= 'build';
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join, resolve } = require('path');

module.exports = {
  resolve: {
    alias: { '@packages': resolve(__dirname, '../../packages') },
    extensions: ['.ts', '.js'],
  },
  output: {
    path: join(__dirname, 'dist'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
    })
  ],
};
