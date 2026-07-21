// Leitura de métricas, custo e backups da AWS para o submódulo Tecnologia → Infra/Saúde.
// Credenciais: cadeia padrão do SDK (em prod = IAM role da EC2; local = AWS_PROFILE).
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import {
  EC2Client, DescribeImagesCommand,
} from "@aws-sdk/client-ec2";
import {
  RDSClient, DescribeDBSnapshotsCommand,
} from "@aws-sdk/client-rds";
import {
  BackupClient, ListBackupJobsCommand,
} from "@aws-sdk/client-backup";

// Região dos recursos (EC2/RDS ficam em us-east-1; NÃO herdar AWS_REGION do S3, que é us-east-2)
const REGION       = process.env.INFRA_AWS_REGION || "us-east-1";
const EC2_INSTANCE = process.env.INFRA_EC2_INSTANCE_ID || "i-03c56465532e35626";
const RDS_INSTANCE = process.env.INFRA_RDS_INSTANCE_ID || "iasoclin-db";

// Credenciais dedicadas de infra (não usar as do S3/render-api, que não têm CloudWatch/CE).
// Em produção, deixe estas vazias e anexe uma IAM role à EC2 → o SDK usa a role automaticamente.
const infraCreds =
  process.env.INFRA_AWS_ACCESS_KEY_ID && process.env.INFRA_AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId:     process.env.INFRA_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.INFRA_AWS_SECRET_ACCESS_KEY,
        },
      }
    : {};

const cfg = { region: REGION, ...infraCreds };
const cw     = new CloudWatchClient(cfg);
const ce     = new CostExplorerClient({ region: "us-east-1", ...infraCreds }); // CE só existe em us-east-1
const ec2    = new EC2Client(cfg);
const rds    = new RDSClient(cfg);
const backup = new BackupClient(cfg);

export const INFRA_IDS = { region: REGION, ec2: EC2_INSTANCE, rds: RDS_INSTANCE };

function isConfigured() {
  return !!EC2_INSTANCE && !!RDS_INSTANCE;
}

// ── Métricas (CloudWatch) ───────────────────────────────────────────────────
async function metric({ namespace, metricName, dimensions, stat = "Average", minutes = 180, period = 300 }) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  const out = await cw.send(new GetMetricStatisticsCommand({
    Namespace: namespace,
    MetricName: metricName,
    Dimensions: dimensions,
    StartTime: start,
    EndTime: end,
    Period: period,
    Statistics: [stat],
  }));
  const points = (out.Datapoints ?? [])
    .map((d) => ({ t: d.Timestamp, v: d[stat] }))
    .sort((a, b) => new Date(a.t) - new Date(b.t));
  return points;
}

export async function getMetrics() {
  const [
    ec2Cpu, ec2NetIn, ec2NetOut,
    rdsCpu, rdsMemFree, rdsConns, rdsStorageFree,
  ] = await Promise.all([
    metric({ namespace: "AWS/EC2", metricName: "CPUUtilization",   dimensions: [{ Name: "InstanceId", Value: EC2_INSTANCE }] }),
    metric({ namespace: "AWS/EC2", metricName: "NetworkIn",        dimensions: [{ Name: "InstanceId", Value: EC2_INSTANCE }], stat: "Average" }),
    metric({ namespace: "AWS/EC2", metricName: "NetworkOut",       dimensions: [{ Name: "InstanceId", Value: EC2_INSTANCE }], stat: "Average" }),
    metric({ namespace: "AWS/RDS", metricName: "CPUUtilization",   dimensions: [{ Name: "DBInstanceIdentifier", Value: RDS_INSTANCE }] }),
    metric({ namespace: "AWS/RDS", metricName: "FreeableMemory",   dimensions: [{ Name: "DBInstanceIdentifier", Value: RDS_INSTANCE }] }),
    metric({ namespace: "AWS/RDS", metricName: "DatabaseConnections", dimensions: [{ Name: "DBInstanceIdentifier", Value: RDS_INSTANCE }] }),
    metric({ namespace: "AWS/RDS", metricName: "FreeStorageSpace", dimensions: [{ Name: "DBInstanceIdentifier", Value: RDS_INSTANCE }] }),
  ]);

  const last = (arr) => (arr.length ? arr[arr.length - 1].v : null);
  const toMB = (bytes) => (bytes == null ? null : Math.round(bytes / 1024 / 1024));

  return {
    ids: INFRA_IDS,
    ec2: {
      cpu:      { current: last(ec2Cpu), series: ec2Cpu },
      netInKB:  { current: last(ec2NetIn) != null ? Math.round(last(ec2NetIn) / 1024) : null },
      netOutKB: { current: last(ec2NetOut) != null ? Math.round(last(ec2NetOut) / 1024) : null },
    },
    rds: {
      cpu:            { current: last(rdsCpu), series: rdsCpu },
      freeMemoryMB:   { current: toMB(last(rdsMemFree)), series: rdsMemFree.map((p) => ({ t: p.t, v: toMB(p.v) })) },
      connections:    { current: last(rdsConns), series: rdsConns },
      freeStorageMB:  { current: toMB(last(rdsStorageFree)) },
    },
  };
}

// ── Custo (Cost Explorer) ───────────────────────────────────────────────────
export async function getCost() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  // CE exige end > start; se hoje for dia 1, usa amanhã
  const endSafe = end === start ? new Date(now.getTime() + 86400000).toISOString().slice(0, 10) : end;

  const out = await ce.send(new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: endSafe },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
  }));

  const group = out.ResultsByTime?.[0]?.Groups ?? [];
  const services = group
    .map((g) => ({
      service: g.Keys?.[0] ?? "—",
      amount: Number(g.Metrics?.UnblendedCost?.Amount ?? 0),
      unit: g.Metrics?.UnblendedCost?.Unit ?? "USD",
    }))
    .filter((s) => s.amount > 0.0001)
    .sort((a, b) => b.amount - a.amount);

  const total = services.reduce((s, x) => s + x.amount, 0);
  return {
    period: { start, end: endSafe },
    currency: services[0]?.unit ?? "USD",
    total,
    services,
  };
}

// ── Backups (RDS snapshots + EC2 AMIs + jobs) ───────────────────────────────
export async function getBackups(days = 3) {
  const since = new Date(Date.now() - days * 86400000);

  const [snaps, amis, ec2Jobs, rdsJobs] = await Promise.all([
    rds.send(new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: RDS_INSTANCE })),
    ec2.send(new DescribeImagesCommand({ Owners: ["self"] })),
    backup.send(new ListBackupJobsCommand({ ByResourceType: "EC2", MaxResults: 20 })),
    backup.send(new ListBackupJobsCommand({ ByResourceType: "RDS", MaxResults: 20 })),
  ]);

  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const uniqueDays = (items) => new Set(items.map((i) => dayKey(i.createdAt))).size;

  const rdsBackups = (snaps.DBSnapshots ?? [])
    .filter((s) => s.SnapshotCreateTime && new Date(s.SnapshotCreateTime) >= since)
    .map((s) => ({
      id: s.DBSnapshotIdentifier,
      createdAt: s.SnapshotCreateTime,
      status: s.Status,
      type: s.SnapshotType, // "automated" (RDS nativo) ou "awsbackup" (AWS Backup)
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const ec2Backups = (amis.Images ?? [])
    .filter((i) => i.CreationDate && new Date(i.CreationDate) >= since)
    .map((i) => ({
      id: i.ImageId,
      name: i.Name,
      createdAt: i.CreationDate,
      status: i.State,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Falhas de job nos últimos N dias
  const allJobs = [...(ec2Jobs.BackupJobs ?? []), ...(rdsJobs.BackupJobs ?? [])];
  const failures = allJobs
    .filter((j) => j.CreationDate && new Date(j.CreationDate) >= since)
    .filter((j) => ["FAILED", "ABORTED", "EXPIRED"].includes(j.State))
    .map((j) => ({
      id: j.BackupJobId,
      resource: j.ResourceType,
      state: j.State,
      createdAt: j.CreationDate,
      message: j.StatusMessage,
    }));

  // "found" = dias distintos cobertos (não nº de snapshots) — evita confusão do RDS,
  // que tem 2 fontes/dia (automated + awsbackup).
  return {
    days,
    ec2: {
      expected: days, found: uniqueDays(ec2Backups),
      total: ec2Backups.length, items: ec2Backups,
    },
    rds: {
      expected: days, found: uniqueDays(rdsBackups),
      total: rdsBackups.length,
      sources: {
        automated: rdsBackups.filter((b) => b.type === "automated").length,
        awsbackup: rdsBackups.filter((b) => b.type === "awsbackup").length,
      },
      items: rdsBackups,
    },
    failures,
  };
}

export function infraConfigured() { return isConfigured(); }
