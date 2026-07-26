import { Router } from "express";
import { assertIos, asyncIosRoute } from "./ios.errors.js";
import {
  assertDateRange,
  dateValue,
  decimalValue,
  definedData,
  enumValue,
  hasOwn,
  integerValue,
  jsonArray,
  optionalString,
  requiredString,
} from "./ios.validation.js";
import * as phase2 from "./ios.phase2.service.js";
import * as phase3 from "./ios.phase3.service.js";

const router = Router();

const RECORD_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];
const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELED"];
const PARTNER_STATUSES = ["PROSPECT", "ACTIVE", "PAUSED", "ENDED"];
const COMMISSION_STATUSES = ["PENDING", "APPROVED", "PAID", "CANCELED"];
const RELEASE_STATUSES = ["PLANNED", "IN_PROGRESS", "RELEASED", "CANCELED"];
const POSITION_TYPES = ["CURRENT", "PLANNED"];
const POSITION_STATUSES = ["OPEN", "FILLED", "ON_HOLD", "CLOSED"];

function ensureChanges(data) {
  assertIos(
    Object.keys(data).length > 0,
    400,
    "IOS_EMPTY_UPDATE",
    "Informe ao menos um campo para atualizar."
  );
  return data;
}

function nullableId(value, field) {
  return optionalString(value, field, { max: 40 });
}

function money(value, field, optional = true) {
  return decimalValue(value, field, { optional });
}

function scenarioAssumptions(value) {
  const list = jsonArray(value, "assumptions", { maxItems: 30 });
  return list.map((item, index) => {
    const key = requiredString(item?.key, `assumptions[${index}].key`, { max: 80 });
    assertIos(
      /^[a-z][a-zA-Z0-9]*$/.test(key),
      400,
      "IOS_VALIDATION_ERROR",
      `assumptions[${index}].key deve usar camelCase.`
    );
    return {
      key,
      label: requiredString(item?.label, `assumptions[${index}].label`, { max: 120 }),
      value: decimalValue(item?.value, `assumptions[${index}].value`),
      unit: requiredString(item?.unit, `assumptions[${index}].unit`, { max: 30 }),
      justification: optionalString(
        item?.justification,
        `assumptions[${index}].justification`,
        { max: 1000 }
      ),
      sourceRef: optionalString(item?.sourceRef, `assumptions[${index}].sourceRef`, { max: 500 }),
      sortOrder: integerValue(item?.sortOrder ?? index, `assumptions[${index}].sortOrder`, {
        max: 1000,
      }),
    };
  });
}

function scenarioPayload(body, patch = false) {
  const horizonStart = dateValue(body.horizonStart, "horizonStart", { optional: patch });
  const horizonEnd = dateValue(body.horizonEnd, "horizonEnd", { optional: patch });
  if (horizonStart && horizonEnd) assertDateRange(horizonStart, horizonEnd, { maxDays: 1827 });
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 160 }),
    description: optionalString(body.description, "description", { max: 3000 }),
    horizonStart,
    horizonEnd,
    assumptions: hasOwn(body, "assumptions")
      ? scenarioAssumptions(body.assumptions)
      : patch
        ? undefined
        : scenarioAssumptions(body.assumptions),
  });
  return patch ? ensureChanges(data) : data;
}

router.get("/performance", asyncIosRoute(async (req, res) => {
  res.json(await phase2.getPerformanceOverview(req.ios, req.query.month));
}));

router.post("/performance/sync", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase2.syncOfficialMetrics(req.ios, req.body.month));
}));

router.get("/scenarios", asyncIosRoute(async (req, res) => {
  res.json(await phase2.listScenarios(req.ios));
}));

router.post("/scenarios", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase2.createScenario(req.ios, scenarioPayload(req.body)));
}));

router.patch("/scenarios/:id", asyncIosRoute(async (req, res) => {
  res.json(await phase2.updateScenario(req.ios, req.params.id, scenarioPayload(req.body, true)));
}));

router.post("/scenarios/:id/run", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase2.runScenario(req.ios, req.params.id));
}));

router.post("/scenarios/:id/publish", asyncIosRoute(async (req, res) => {
  res.json(await phase2.publishScenario(req.ios, req.params.id));
}));

router.post("/scenarios/:id/versions", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase2.versionScenario(req.ios, req.params.id));
}));

function channelPayload(body, patch = false) {
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 120 }),
    category: optionalString(body.category, "category", { max: 80 }),
    status: enumValue(body.status ?? (patch ? undefined : "ACTIVE"), "status", RECORD_STATUSES, {
      optional: patch,
    }),
    monthlyBudget: money(body.monthlyBudget, "monthlyBudget"),
    notes: optionalString(body.notes, "notes", { max: 3000 }),
  });
  return patch ? ensureChanges(data) : data;
}

function campaignPayload(body, patch = false) {
  const startDate = dateValue(body.startDate, "startDate", { optional: true, nullable: true });
  const endDate = dateValue(body.endDate, "endDate", { optional: true, nullable: true });
  if (startDate && endDate) assertDateRange(startDate, endDate, { maxDays: 1827 });
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 160 }),
    channelId: nullableId(body.channelId, "channelId"),
    objective: optionalString(body.objective, "objective", { max: 1000 }),
    status: enumValue(body.status ?? (patch ? undefined : "DRAFT"), "status", CAMPAIGN_STATUSES, {
      optional: patch,
    }),
    startDate,
    endDate,
    budget: money(body.budget, "budget"),
    notes: optionalString(body.notes, "notes", { max: 3000 }),
  });
  return patch ? ensureChanges(data) : data;
}

function partnerPayload(body, patch = false) {
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 160 }),
    status: enumValue(body.status ?? (patch ? undefined : "PROSPECT"), "status", PARTNER_STATUSES, {
      optional: patch,
    }),
    contactName: optionalString(body.contactName, "contactName", { max: 160 }),
    contactEmail: optionalString(body.contactEmail, "contactEmail", { max: 240 }),
    commissionType: optionalString(body.commissionType, "commissionType", { max: 40 }),
    commissionValue: money(body.commissionValue, "commissionValue"),
    notes: optionalString(body.notes, "notes", { max: 3000 }),
  });
  return patch ? ensureChanges(data) : data;
}

function commissionPayload(body, patch = false) {
  const data = definedData({
    partnerId: nullableId(body.partnerId, "partnerId"),
    leadId: nullableId(body.leadId, "leadId"),
    description: patch && !hasOwn(body, "description")
      ? undefined
      : requiredString(body.description, "description", { max: 220 }),
    amount: money(body.amount, "amount", patch),
    status: enumValue(
      body.status ?? (patch ? undefined : "PENDING"),
      "status",
      COMMISSION_STATUSES,
      { optional: patch }
    ),
    dueDate: dateValue(body.dueDate, "dueDate", { optional: true, nullable: true }),
    paidAt: dateValue(body.paidAt, "paidAt", { optional: true, nullable: true }),
    notes: optionalString(body.notes, "notes", { max: 3000 }),
  });
  return patch ? ensureChanges(data) : data;
}

const commercialRoutes = [
  ["channels", "channel", channelPayload],
  ["campaigns", "campaign", campaignPayload],
  ["partners", "partner", partnerPayload],
  ["commissions", "commission", commissionPayload],
];

router.get("/commercial", asyncIosRoute(async (req, res) => {
  res.json(await phase3.getCommercialOverview(req.ios));
}));

for (const [path, resource, payload] of commercialRoutes) {
  router.post(`/commercial/${path}`, asyncIosRoute(async (req, res) => {
    res.status(201).json(
      await phase3.createCommercialRecord(req.ios, resource, payload(req.body))
    );
  }));
  router.patch(`/commercial/${path}/:id`, asyncIosRoute(async (req, res) => {
    res.json(
      await phase3.updateCommercialRecord(req.ios, resource, req.params.id, payload(req.body, true))
    );
  }));
}

function releasePayload(body, patch = false) {
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 160 }),
    version: optionalString(body.version, "version", { max: 60 }),
    description: optionalString(body.description, "description", { max: 3000 }),
    status: enumValue(
      body.status ?? (patch ? undefined : "PLANNED"),
      "status",
      RELEASE_STATUSES,
      { optional: patch }
    ),
    plannedAt: dateValue(body.plannedAt, "plannedAt", { optional: true, nullable: true }),
    releasedAt: dateValue(body.releasedAt, "releasedAt", { optional: true, nullable: true }),
  });
  return patch ? ensureChanges(data) : data;
}

router.get("/product", asyncIosRoute(async (req, res) => {
  res.json(await phase3.getProductOverview(req.ios));
}));

router.post("/product/releases", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase3.createRelease(req.ios, releasePayload(req.body)));
}));

router.patch("/product/releases/:id", asyncIosRoute(async (req, res) => {
  res.json(await phase3.updateRelease(req.ios, req.params.id, releasePayload(req.body, true)));
}));

router.post("/product/releases/:id/tasks", asyncIosRoute(async (req, res) => {
  const taskId = requiredString(req.body.taskId, "taskId", { max: 40 });
  res.status(201).json(await phase3.linkReleaseTask(req.ios, req.params.id, taskId));
}));

router.delete("/product/releases/:id/tasks/:taskId", asyncIosRoute(async (req, res) => {
  res.json(await phase3.unlinkReleaseTask(req.ios, req.params.id, req.params.taskId));
}));

router.post("/product/adoption", asyncIosRoute(async (req, res) => {
  const periodStart = dateValue(req.body.periodStart, "periodStart");
  const periodEnd = dateValue(req.body.periodEnd, "periodEnd");
  assertDateRange(periodStart, periodEnd);
  const payload = {
    featureKey: requiredString(req.body.featureKey, "featureKey", { max: 100 }),
    featureName: requiredString(req.body.featureName, "featureName", { max: 160 }),
    periodStart,
    periodEnd,
    eligibleUsers: integerValue(req.body.eligibleUsers, "eligibleUsers", { max: 1000000 }),
    activeUsers: integerValue(req.body.activeUsers, "activeUsers", { max: 1000000 }),
    usageCount: integerValue(req.body.usageCount ?? 0, "usageCount", { max: 100000000 }),
    sourceRef: requiredString(req.body.sourceRef, "sourceRef", { max: 500 }),
    notes: optionalString(req.body.notes, "notes", { max: 3000 }),
  };
  res.status(201).json(await phase3.createAdoptionSnapshot(req.ios, payload));
}));

function positionPayload(body, patch = false) {
  const data = definedData({
    title: patch && !hasOwn(body, "title")
      ? undefined
      : requiredString(body.title, "title", { max: 160 }),
    area: patch && !hasOwn(body, "area")
      ? undefined
      : requiredString(body.area, "area", { max: 120 }),
    type: enumValue(
      body.type ?? (patch ? undefined : "CURRENT"),
      "type",
      POSITION_TYPES,
      { optional: patch }
    ),
    status: enumValue(
      body.status ?? (patch ? undefined : "OPEN"),
      "status",
      POSITION_STATUSES,
      { optional: patch }
    ),
    occupantUserId: nullableId(body.occupantUserId, "occupantUserId"),
    capacityPercent: integerValue(body.capacityPercent ?? (patch ? undefined : 100), "capacityPercent", {
      optional: patch,
      min: 0,
      max: 300,
    }),
    monthlyCost: money(body.monthlyCost, "monthlyCost"),
    targetDate: dateValue(body.targetDate, "targetDate", { optional: true, nullable: true }),
    notes: optionalString(body.notes, "notes", { max: 3000 }),
  });
  return patch ? ensureChanges(data) : data;
}

router.get("/people", asyncIosRoute(async (req, res) => {
  res.json(await phase3.getPeopleOverview(req.ios));
}));

router.post("/people/positions", asyncIosRoute(async (req, res) => {
  res.status(201).json(await phase3.createPosition(req.ios, positionPayload(req.body)));
}));

router.patch("/people/positions/:id", asyncIosRoute(async (req, res) => {
  res.json(await phase3.updatePosition(req.ios, req.params.id, positionPayload(req.body, true)));
}));

export default router;
