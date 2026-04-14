import { CustomWebpackBrowserSchema, TargetOptions } from '@angular-builders/custom-webpack';
import * as webpack from 'webpack';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

export default (
  config: webpack.Configuration,
  _: CustomWebpackBrowserSchema,
  targetOptions: TargetOptions
) => {
  dotenv.config();

  config.resolve.fallback = {
    ...config.resolve.fallback,
    querystring: require.resolve('querystring-es3'),
    zlib: require.resolve('browserify-zlib')
  };

  if (targetOptions.configuration === 'sdk') {
    const sdkDirectory = '../rubic-sdk/';
    const sdkDirectoryExists = fs.existsSync(sdkDirectory);

    const sdkBundle = '../rubic-sdk/dist/rubic-sdk.min.js';
    const sdkBundleExists = fs.existsSync(sdkBundle);

    if (sdkDirectoryExists) {
      if (sdkBundleExists) {
        config.resolve.alias = {
          ...config.resolve.alias,
          '@cryptorubic/sdk': path.resolve(__dirname, sdkDirectory)
        };
      } else {
        throw new Error(
          `SDK bundle is not found. Run 'yarn build & yarn compile' in sdk directory first.`
        );
      }
    } else {
      throw new Error(
        'Rubic SDK directory is not exists. Clone Rubic SDK repo to ./rubic-sdk/ directory.'
      );
    }
  }

  config.resolve.alias = {
    ...config.resolve.alias,
    '@walletconnect/ethereum-provider': path.resolve(
      __dirname,
      'node_modules/@walletconnect/ethereum-provider/dist/index.umd.js'
    )
  };

  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.AD_CLIENT': JSON.stringify(process.env.AD_CLIENT || ''),
      'process.env.AD_SLOT': JSON.stringify(process.env.AD_SLOT || '')
    })
  );

  return config;
};
