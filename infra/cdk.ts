import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

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

    taskDefinition.addContainer("coin-dc-bot-container", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../"), {
        platform: Platform.LINUX_AMD64,
      }),
      memoryLimitMiB: 512,
      logging: new ecs.AwsLogDriver({
        streamPrefix: serviceName,
        logGroup: new LogGroup(this, "coin-dc-bot-log-group", {
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: 5,
        }),
      }),
    });

    const rule = new events.Rule(this, "coin-dc-bot-rule", {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '15,21,3,9', // UTC 기준으로 0시, 6시, 12시, 18시
      }),
    });

    rule.addTarget(new targets.EcsTask({
      cluster,
      taskDefinition,
    }))
  }
}

const app = new cdk.App();

new CoinDcBotStack(app, "CoinDcBotStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
