import { CustomWebpackBrowserSchema, TargetOptions } from '@angular-builders/custom-webpack';
import { sentryWebpackPlugin } from '@sentry/webpack-plugin';
import * as dotenv from 'dotenv';

import * as webpack from 'webpack';

export default (
  config: webpack.Configuration,
  _: CustomWebpackBrowserSchema,
  targetOptions: TargetOptions
) => {
  dotenv.config();

  config.devtool = 'source-map';
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    vm: false
  };
  config.plugins = config.plugins || [];

  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.AD_CLIENT': JSON.stringify(process.env.AD_CLIENT || ''),
      'process.env.AD_SLOT': JSON.stringify(process.env.AD_SLOT || '')
    })
  );

  const shouldUploadSourceMaps = ['production', 'stage', 'prod-api'].includes(
    targetOptions.configuration || ''
  );

  if (shouldUploadSourceMaps) {
    config.plugins.push(
      sentryWebpackPlugin({
        org: 'rubic',
        project: 'rubic-app',
        authToken:
          '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', //process.env.SENTRY_AUTH_TOKEN,
        bundleSizeOptimizations: {
          excludeReplayIframe: true,
          excludeReplayShadowDom: true,
          excludeReplayWorker: true
        }
      })
    );
  }

  return config;
};
