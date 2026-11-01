#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SilkRoadAtlasStack } from '../lib/stack';

const app = new App();

const originSecret =
  app.node.tryGetContext('originSecret') ??
  process.env.ORIGIN_SECRET ??
  'default_placeholder_secret_for_synth_min_32_chars';

new SilkRoadAtlasStack(app, 'SilkRoadAtlas', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
  description: 'Silk Road Atlas: Uzbekistan heritage map on Amazon Location Service',
  originSecret,
});
