import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { HttpApi, DomainName } from "aws-cdk-lib/aws-apigatewayv2";
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
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  HostedZone,
  ARecord,
  AaaaRecord,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { RustFunction } from "cargo-lambda-cdk";

export class CertStack extends Stack {
  cert: Certificate;
  domain: DomainName;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.cert = new Certificate(this, "Certificate", {
      certificateName: "ashleybuds-api-cert",
      domainName: "ashleybuds.com",
      validation: CertificateValidation.fromDns(
        HostedZone.fromHostedZoneId(this, "HostedZone", "Z05571291S4WY75A1MTSM")
      ),
    });

    this.domain = new DomainName(this, "ApiDomain", {
      domainName: "ashleybuds.com",
      certificate: this.cert,
    });
  }
}
