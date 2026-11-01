import * as path from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as location from 'aws-cdk-lib/aws-location';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface SilkRoadStackProps extends StackProps {
  /** Shared secret CloudFront adds to /api requests so the API can't be called directly. */
  originSecret: string;
}

export class SilkRoadAtlasStack extends Stack {
  constructor(scope: Construct, id: string, props: SilkRoadStackProps) {
    super(scope, id, props);

    // ---------- Static site + dataset ----------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---------- API: Lambda proxy to Amazon Location Routes + Places ----------
    const fn = new lambda.Function(this, 'GeoApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'app.handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'backend', 'build')),
      memorySize: 256,
      timeout: Duration.seconds(15),
      environment: {
        LOG_LEVEL: 'INFO',
        ORIGIN_VERIFY_SECRET: props.originSecret,
      },
      logGroup: new logs.LogGroup(this, 'GeoApiLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['geo-routes:CalculateRoutes', 'geo-routes:OptimizeWaypoints', 'geo-routes:CalculateIsolines'],
        resources: [`arn:aws:geo-routes:${this.region}::provider/default`],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['geo-places:SearchText', 'geo-places:ReverseGeocode'],
        resources: [`arn:aws:geo-places:${this.region}::provider/default`],
      }),
    );

    const api = new HttpApi(this, 'GeoHttpApi', { createDefaultStage: false });
    new HttpStage(this, 'DefaultStage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    });
    const integration = new HttpLambdaIntegration('GeoIntegration', fn);
    api.addRoutes({ path: '/api/route', methods: [HttpMethod.POST], integration });
    api.addRoutes({ path: '/api/isoline', methods: [HttpMethod.POST], integration });
    api.addRoutes({ path: '/api/search', methods: [HttpMethod.GET], integration });
    api.addRoutes({ path: '/api/reverse', methods: [HttpMethod.GET], integration });

    // ---------- CloudFront: one domain for site + API ----------
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      comment: 'Silk Road Atlas',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: securityHeaders,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`, {
            customHeaders: { 'X-Origin-Verify': props.originSecret },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: securityHeaders,
        },
      },
    });

    // ---------- Amazon Location Maps API key (browser-safe, maps only) ----------
    const mapsKey = new location.CfnAPIKey(this, 'MapsApiKey', {
      keyName: `${id}-maps-key`,
      description: 'Silk Road Atlas: base map tiles only, restricted to the CloudFront domain',
      noExpiry: true,
      restrictions: {
        allowActions: ['geo-maps:*'],
        allowResources: [`arn:aws:geo-maps:${this.region}::provider/default`],
        allowReferers: [`https://${distribution.distributionDomainName}/*`, 'http://localhost:5173/*'],
      },
    });

    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'MapsApiKeyName', { value: mapsKey.keyName });
    new CfnOutput(this, 'Region', { value: this.region });
  }
}
