#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SilkRoadAtlasStack } from '../lib/stack';

const app = new App();

const originSecret = app.node.tryGetContext('originSecret') ?? process.env.ORIGIN_SECRET;
if (typeof originSecret !== 'string' || originSecret.length < 32) {
  throw new Error('Provide a random originSecret (>= 32 chars) via `-c originSecret=...` or ORIGIN_SECRET env var.');
}

new SilkRoadAtlasStack(app, 'SilkRoadAtlas', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
  description: 'Silk Road Atlas: Uzbekistan heritage map on Amazon Location Service',
  originSecret,
});
