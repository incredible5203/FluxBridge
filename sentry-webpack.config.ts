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

  // Vercel build containers have limited RAM; default webpack parallelism can OOM (SIGKILL).
  if (process.env.VERCEL) {
    config.parallelism = 1;
  }

  const isReleaseBuild = ['production', 'stage', 'prod-api'].includes(
    targetOptions.configuration || ''
  );
  const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN);
  const shouldUploadSourceMaps = isReleaseBuild && hasSentryToken;

  // Full source maps are very memory-heavy. Only enable them when Sentry upload is configured.
  if (shouldUploadSourceMaps) {
    config.devtool = 'source-map';
  } else if (isReleaseBuild) {
    config.devtool = false;
  }

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

  if (shouldUploadSourceMaps) {
    config.plugins.push(
      sentryWebpackPlugin({
        org: 'rubic',
        project: 'rubic-app',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
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
