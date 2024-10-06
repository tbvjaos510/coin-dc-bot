import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import { Construct } from "constructs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import * as path from "node:path";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

class CoinDcBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: any) {
    super(scope, id, props);

    const serviceName = "coin-dc-bot";

    const vpc = ec2.Vpc.fromLookup(this, "vpc", {
      vpcName: "default",
    });

    const cluster = ecs.Cluster.fromClusterAttributes(this, "ecs-cluster", {
      clusterName: "my-dev-ecs-cluster",
      vpc,
      securityGroups: [],
    });

    const taskDefinition = new ecs.Ec2TaskDefinition(this, "coin-dc-bot-task-def", {
      family: "coin-dc-bot-task",
      networkMode: ecs.NetworkMode.HOST,
    });

    const mognodbSecret = secretsmanager.Secret.fromSecretNameV2(this, "MongoDbPassword", "MongoDbPassword")

    taskDefinition.addContainer("coin-dc-bot-container", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../"), {
        platform: Platform.LINUX_AMD64,
      }),
      memoryLimitMiB: 256,
      environment: {
        MONGO_URI: "mongodb://localhost:27017",
      },
      secrets: {
        MONGO_USERNAME: ecs.Secret.fromSecretsManager(mognodbSecret, "username"),
        MONGO_PASSWORD: ecs.Secret.fromSecretsManager(mognodbSecret, "password"),
      },
      logging: new ecs.AwsLogDriver({
        streamPrefix: serviceName,
        logGroup: new LogGroup(this, "coin-dc-bot-log-group", {
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: 5,
        }),
      }),
    });

    const ecsService = new ecs.Ec2Service(this, "coin-dc-bot-service", {
      serviceName,
      cluster,
      taskDefinition,
      desiredCount: 1,
      circuitBreaker: {
        rollback: true
      },
    });
  }
}

const app = new cdk.App();

new CoinDcBotStack(app, "CoinDcBotStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
