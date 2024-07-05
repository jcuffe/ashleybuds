import { join } from "node:path";

import { Stack, StackProps, Fn } from "aws-cdk-lib";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import {
  HttpApi,
  DomainName,
  CfnDomainName,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import * as CF from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as CFOrigin from "aws-cdk-lib/aws-cloudfront-origins";
import {
  HostedZone,
  ARecord,
  AaaaRecord,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import * as S3 from "aws-cdk-lib/aws-s3";
import * as S3Deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { RustFunction } from "cargo-lambda-cdk";

import { CertStack } from "./cert-stack";

export class CdkStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps & { certStack: CertStack }
  ) {
    super(scope, id, props);

    const manifestPath = join(__dirname, "..", "..");
    const assetsPath = join(__dirname, "..", "..", "assets");

    const bucket = new S3.Bucket(this, "AssetBucket", {
      bucketName: "ashleybuds-assets-bucket",
    });

    new S3Deploy.BucketDeployment(this, "AssetDeployment", {
      destinationBucket: bucket,
      sources: [S3Deploy.Source.asset(assetsPath)],
    });

    const rootHandler = new RustFunction(this, "LambdaRoot", {
      functionName: "ashleybuds-root",
      binaryName: "root",
      bundling: { architecture: Architecture.ARM_64 },
      manifestPath,
    });

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      zoneName: "ashleybuds.com",
      hostedZoneId: "Z05571291S4WY75A1MTSM",
    });

    const cert = new Certificate(this, "Certificate", {
      certificateName: "ashleybuds-api-cert",
      domainName: "ashleybuds.com",
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const domain = new DomainName(this, "ApiDomain", {
      domainName: "ashleybuds.com",
      certificate: cert,
    });

    const api = new HttpApi(this, "HttpApi", {
      apiName: "ashleybuds-api",
      defaultDomainMapping: { domainName: domain },
      defaultIntegration: new HttpLambdaIntegration(
        "LambdaRootIntegration",
        rootHandler
      ),
    });

    const rewriteFn = new CF.Function(this, "PathRewriteFunction", {
      functionName: "ashleybuds-path-rewrite",
      runtime: CF.FunctionRuntime.JS_2_0,
      code: CF.FunctionCode.fromFile({
        filePath: join(__dirname, "path-rewrite.js"),
      }),
    });

    const distribution = new Distribution(this, "Distribution", {
      certificate: props.certStack.cert,
      domainNames: [domain.name],
      defaultBehavior: {
        origin: new HttpOrigin(Fn.parseDomainName(api.apiEndpoint)),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      additionalBehaviors: {
        "/favicon.ico": {
          origin: new CFOrigin.S3Origin(bucket),
          allowedMethods: CF.AllowedMethods.ALLOW_GET_HEAD,
        },
        "/assets/*": {
          origin: new CFOrigin.S3Origin(bucket),
          allowedMethods: CF.AllowedMethods.ALLOW_GET_HEAD,
          // TODO: just namespace the assets in the bucket instead
          functionAssociations: [
            {
              eventType: CF.FunctionEventType.VIEWER_REQUEST,
              function: rewriteFn,
            },
          ],
        },
      },
    });

    new ARecord(this, "ApiARecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
  }
}
