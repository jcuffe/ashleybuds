#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { CdkStack } from "../lib/cdk-stack";
import { CertStack } from "../lib/cert-stack";

const app = new App();

const certStack = new CertStack(app, "CertStack", {
  stackName: "ashleybuds-cert-stack",
  crossRegionReferences: true,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});

new CdkStack(app, "CdkStack", {
  stackName: "ashleybuds-stack",
  certStack,
  crossRegionReferences: true,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
