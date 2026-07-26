import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireIosOwner } from "./ios.access.js";
import { assertIos, asyncIosRoute, iosErrorMiddleware } from "./ios.errors.js";
import * as service from "./ios.service.js";
import phase23Routes from "./ios.phase23.routes.js";
import {
  assertDateRange,
  booleanValue,
  dateValue,
  decimalValue,
  definedData,
  enumValue,
  hasOwn,
  integerValue,
  jsonArray,
  metricCode,
  optionalString,
  requiredString,
  stringArray,
} from "./ios.validation.js";

const router = Router();

const CYCLE_CADENCES = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"];
const CYCLE_STATUSES = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];
const OBJECTIVE_STATUSES = ["DRAFT", "ACTIVE", "AT_RISK", "COMPLETED", "CANCELED"];
const KEY_RESULT_STATUSES = ["DRAFT", "ACTIVE", "AT_RISK", "ACHIEVED", "CANCELED"];
const INITIATIVE_STATUSES = ["PLANNED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELED"];
const MILESTONE_STATUSES = ["PENDING", "COMPLETED", "CANCELED"];
const DECISION_STATUSES = ["DRAFT", "DECIDED", "REVIEWED", "REVERSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const METRIC_UNITS = ["NUMBER", "BRL", "PERCENTAGE", "DAYS", "MONTHS", "SCORE"];
const METRIC_DIRECTIONS = ["INCREASE", "DECREASE", "MAINTAIN"];
const METRIC_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ON_DEMAND"];
const METRIC_SOURCE_TYPES = ["MANUAL", "CALCULATED", "IMPORTED", "EXTERNAL"];

router.use(authMiddleware);
router.use(requireIosOwner);
router.use(phase23Routes);

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

function workspacePayload(body, patch = false) {
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 120 }),
    mission: optionalString(body.mission, "mission", { max: 3000 }),
    vision: optionalString(body.vision, "vision", { max: 3000 }),
    values: stringArray(body.values, "values", { optional: true, maxItems: 20, itemMax: 200 }),
    timezone: optionalString(body.timezone, "timezone", { max: 80 }),
    currency: optionalString(body.currency, "currency", { max: 3 }),
  });
  return patch ? ensureChanges(data) : data;
}

function cyclePayload(body, patch = false) {
  const startDate = dateValue(body.startDate, "startDate", { optional: patch });
  const endDate = dateValue(body.endDate, "endDate", { optional: patch });
  if (startDate && endDate) assertDateRange(startDate, endDate);
  const data = definedData({
    name: patch && !hasOwn(body, "name")
      ? undefined
      : requiredString(body.name, "name", { max: 120 }),
    description: optionalString(body.description, "description", { max: 3000 }),
    cadence: enumValue(
      body.cadence ?? (patch ? undefined : "QUARTERLY"),
      "cadence",
      CYCLE_CADENCES,
      { optional: patch }
    ),
    startDate,
    endDate,
    status: enumValue(
      body.status ?? (patch ? undefined : "DRAFT"),
      "status",
      CYCLE_STATUSES,
      { optional: patch }
    ),
    ownerId: nullableId(body.ownerId, "ownerId"),
  });
  return patch ? ensureChanges(data) : data;
}

function objectivePayload(body, patch = false) {
  const data = definedData({
    title: patch && !hasOwn(body, "title")
      ? undefined
      : requiredString(body.title, "title", { max: 200 }),
    description: optionalString(body.description, "description", { max: 5000 }),
    status: enumValue(
      body.status ?? (patch ? undefined : "DRAFT"),
      "status",
      OBJECTIVE_STATUSES,
      { optional: patch }
    ),
    ownerId: nullableId(body.ownerId, "ownerId"),
    sortOrder: integerValue(body.sortOrder, "sortOrder", { optional: true, max: 10000 }),
  });
  return patch ? ensureChanges(data) : data;
}

function keyResultPayload(body, patch = false) {
  const baseline = decimalValue(body.baseline, "baseline", { optional: patch });
  const target = decimalValue(body.target, "target", { optional: patch });
  if (baseline !== undefined && target !== undefined) {
    assertIos(
      baseline !== target,
      400,
      "IOS_KEY_RESULT_TARGET_EQUALS_BASELINE",
      "O alvo do resultado-chave deve ser diferente do baseline."
    );
  }
  const startDate = dateValue(body.startDate, "startDate", { optional: patch });
  const dueDate = dateValue(body.dueDate, "dueDate", { optional: patch });
  if (startDate && dueDate) assertDateRange(startDate, dueDate);
  const data = definedData({
    title: patch && !hasOwn(body, "title")
      ? undefined
      : requiredString(body.title, "title", { max: 220 }),
    metricId: patch && !hasOwn(body, "metricId")
      ? undefined
      : requiredString(body.metricId, "metricId", { max: 40 }),
    baseline,
    target,
    startDate,
    dueDate,
    status: enumValue(
      body.status ?? (patch ? undefined : "DRAFT"),
      "status",
      KEY_RESULT_STATUSES,
      { optional: patch }
    ),
    ownerId: nullableId(body.ownerId, "ownerId"),
  });
  return patch ? ensureChanges(data) : data;
}

function initiativePayload(body, patch = false) {
  const startDate = dateValue(body.startDate, "startDate", {
    optional: true,
    nullable: true,
  });
  const dueDate = dateValue(body.dueDate, "dueDate", {
    optional: true,
    nullable: true,
  });
  if (startDate && dueDate) assertDateRange(startDate, dueDate);
  const data = definedData({
    title: patch && !hasOwn(body, "title")
      ? undefined
      : requiredString(body.title, "title", { max: 220 }),
    description: optionalString(body.description, "description", { max: 5000 }),
    objectiveId: nullableId(body.objectiveId, "objectiveId"),
    status: enumValue(
      body.status ?? (patch ? undefined : "PLANNED"),
      "status",
      INITIATIVE_STATUSES,
      { optional: patch }
    ),
    priority: enumValue(
      body.priority ?? (patch ? undefined : "MEDIUM"),
      "priority",
      PRIORITIES,
      { optional: patch }
    ),
    ownerId: nullableId(body.ownerId, "ownerId"),
    startDate,
    dueDate,
  });
  return patch ? ensureChanges(data) : data;
}

function metricPayload(body, patch = false) {
  if (patch) {
    return ensureChanges(definedData({
      name: hasOwn(body, "name") ? requiredString(body.name, "name", { max: 160 }) : undefined,
      description: hasOwn(body, "description")
        ? requiredString(body.description, "description", { max: 3000 })
        : undefined,
      direction: enumValue(body.direction, "direction", METRIC_DIRECTIONS, { optional: true }),
      frequency: enumValue(body.frequency, "frequency", METRIC_FREQUENCIES, { optional: true }),
      sourceRef: hasOwn(body, "sourceRef")
        ? requiredString(body.sourceRef, "sourceRef", { max: 500 })
        : undefined,
      formulaVersion: optionalString(body.formulaVersion, "formulaVersion", { max: 40 }),
      ownerId: nullableId(body.ownerId, "ownerId"),
      isActive: booleanValue(body.isActive, "isActive", { optional: true }),
    }));
  }

  const sourceType = enumValue(body.sourceType, "sourceType", METRIC_SOURCE_TYPES);
  const allowManualInput = booleanValue(body.allowManualInput ?? sourceType === "MANUAL", "allowManualInput");
  const formulaKey = optionalString(body.formulaKey, "formulaKey", { max: 120 });
  const formulaVersion = optionalString(body.formulaVersion, "formulaVersion", { max: 40 });
  if (sourceType === "CALCULATED") {
    assertIos(
      formulaKey && formulaVersion,
      400,
      "IOS_METRIC_FORMULA_REQUIRED",
      "Métrica calculada exige formulaKey e formulaVersion."
    );
    assertIos(
      !allowManualInput,
      400,
      "IOS_METRIC_MANUAL_CALCULATED_CONFLICT",
      "Métrica calculada não pode aceitar lançamento manual."
    );
  }

  return {
    code: metricCode(body.code),
    name: requiredString(body.name, "name", { max: 160 }),
    description: requiredString(body.description, "description", { max: 3000 }),
    unit: enumValue(body.unit, "unit", METRIC_UNITS),
    direction: enumValue(body.direction ?? "INCREASE", "direction", METRIC_DIRECTIONS),
    frequency: enumValue(body.frequency ?? "MONTHLY", "frequency", METRIC_FREQUENCIES),
    sourceType,
    sourceRef: requiredString(body.sourceRef, "sourceRef", { max: 500 }),
    formulaKey,
    formulaVersion,
    allowManualInput,
    ownerId: nullableId(body.ownerId, "ownerId"),
  };
}

function decisionPayload(body, patch = false) {
  const data = definedData({
    title: patch && !hasOwn(body, "title")
      ? undefined
      : requiredString(body.title, "title", { max: 220 }),
    context: patch && !hasOwn(body, "context")
      ? undefined
      : requiredString(body.context, "context", { max: 10000 }),
    decision: patch && !hasOwn(body, "decision")
      ? undefined
      : requiredString(body.decision, "decision", { max: 10000 }),
    rationale: optionalString(body.rationale, "rationale", { max: 10000 }),
    alternatives: jsonArray(body.alternatives, "alternatives", { optional: true }),
    evidence: jsonArray(body.evidence, "evidence", { optional: true }),
    status: enumValue(
      body.status ?? (patch ? undefined : "DRAFT"),
      "status",
      DECISION_STATUSES,
      { optional: patch }
    ),
    cycleId: nullableId(body.cycleId, "cycleId"),
    objectiveId: nullableId(body.objectiveId, "objectiveId"),
    reviewAt: dateValue(body.reviewAt, "reviewAt", { optional: true, nullable: true }),
  });
  return patch ? ensureChanges(data) : data;
}

router.get("/access", asyncIosRoute(async (req, res) => {
  res.json(await service.getAccess(req.ios));
}));

router.get("/workspace", asyncIosRoute(async (req, res) => {
  res.json(await service.getWorkspace(req.ios));
}));

router.post("/bootstrap", asyncIosRoute(async (req, res) => {
  res.status(201).json(await service.bootstrap(req.ios));
}));

router.patch("/workspace", asyncIosRoute(async (req, res) => {
  res.json(await service.updateWorkspace(req.ios, workspacePayload(req.body, true)));
}));

router.get("/team", asyncIosRoute(async (req, res) => {
  res.json(await service.getTeam(req.ios));
}));

router.get("/cockpit", asyncIosRoute(async (req, res) => {
  res.json(await service.getCockpit(req.ios));
}));

router.get("/cycles", asyncIosRoute(async (req, res) => {
  res.json(await service.listCycles(req.ios));
}));

router.post("/cycles", asyncIosRoute(async (req, res) => {
  res.status(201).json(await service.createCycle(req.ios, cyclePayload(req.body)));
}));

router.patch("/cycles/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateCycle(req.ios, req.params.id, cyclePayload(req.body, true)));
}));

router.delete("/cycles/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.archiveCycle(req.ios, req.params.id));
}));

router.post("/cycles/:cycleId/objectives", asyncIosRoute(async (req, res) => {
  res.status(201).json(
    await service.createObjective(req.ios, req.params.cycleId, objectivePayload(req.body))
  );
}));

router.patch("/objectives/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateObjective(req.ios, req.params.id, objectivePayload(req.body, true)));
}));

router.delete("/objectives/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.cancelObjective(req.ios, req.params.id));
}));

router.post("/objectives/:objectiveId/key-results", asyncIosRoute(async (req, res) => {
  res.status(201).json(
    await service.createKeyResult(req.ios, req.params.objectiveId, keyResultPayload(req.body))
  );
}));

router.patch("/key-results/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateKeyResult(req.ios, req.params.id, keyResultPayload(req.body, true)));
}));

router.delete("/key-results/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.cancelKeyResult(req.ios, req.params.id));
}));

router.get("/metrics", asyncIosRoute(async (req, res) => {
  res.json(await service.listMetrics(req.ios));
}));

router.post("/metrics", asyncIosRoute(async (req, res) => {
  res.status(201).json(await service.createMetric(req.ios, metricPayload(req.body)));
}));

router.patch("/metrics/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateMetric(req.ios, req.params.id, metricPayload(req.body, true)));
}));

router.post("/metrics/:id/observations", asyncIosRoute(async (req, res) => {
  const periodStart = dateValue(req.body.periodStart, "periodStart");
  const periodEnd = dateValue(req.body.periodEnd, "periodEnd");
  assertDateRange(periodStart, periodEnd);
  const payload = {
    periodStart,
    periodEnd,
    value: decimalValue(req.body.value, "value"),
    sourceRef: requiredString(req.body.sourceRef, "sourceRef", { max: 500 }),
    note: optionalString(req.body.note, "note", { max: 3000 }),
  };
  res.status(201).json(
    await service.createMetricObservation(req.ios, req.params.id, payload)
  );
}));

router.post("/cycles/:cycleId/initiatives", asyncIosRoute(async (req, res) => {
  res.status(201).json(
    await service.createInitiative(req.ios, req.params.cycleId, initiativePayload(req.body))
  );
}));

router.patch("/initiatives/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateInitiative(req.ios, req.params.id, initiativePayload(req.body, true)));
}));

router.post("/initiatives/:id/milestones", asyncIosRoute(async (req, res) => {
  const payload = {
    title: requiredString(req.body.title, "title", { max: 220 }),
    status: enumValue(req.body.status ?? "PENDING", "status", MILESTONE_STATUSES),
    dueDate: dateValue(req.body.dueDate, "dueDate", { optional: true, nullable: true }),
    sortOrder: integerValue(req.body.sortOrder ?? 0, "sortOrder", { max: 10000 }),
  };
  res.status(201).json(
    await service.createMilestone(req.ios, req.params.id, payload)
  );
}));

router.patch("/milestones/:id", asyncIosRoute(async (req, res) => {
  const payload = ensureChanges(definedData({
    title: hasOwn(req.body, "title")
      ? requiredString(req.body.title, "title", { max: 220 })
      : undefined,
    status: enumValue(req.body.status, "status", MILESTONE_STATUSES, { optional: true }),
    dueDate: dateValue(req.body.dueDate, "dueDate", { optional: true, nullable: true }),
    sortOrder: integerValue(req.body.sortOrder, "sortOrder", { optional: true, max: 10000 }),
  }));
  res.json(await service.updateMilestone(req.ios, req.params.id, payload));
}));

router.post("/initiatives/:id/tasks", asyncIosRoute(async (req, res) => {
  const taskId = requiredString(req.body.taskId, "taskId", { max: 40 });
  res.status(201).json(await service.linkTask(req.ios, req.params.id, taskId));
}));

router.delete("/initiatives/:id/tasks/:taskId", asyncIosRoute(async (req, res) => {
  res.json(await service.unlinkTask(req.ios, req.params.id, req.params.taskId));
}));

router.get("/decisions", asyncIosRoute(async (req, res) => {
  res.json(await service.listDecisions(req.ios));
}));

router.post("/decisions", asyncIosRoute(async (req, res) => {
  res.status(201).json(await service.createDecision(req.ios, decisionPayload(req.body)));
}));

router.patch("/decisions/:id", asyncIosRoute(async (req, res) => {
  res.json(await service.updateDecision(req.ios, req.params.id, decisionPayload(req.body, true)));
}));

router.get("/audit", asyncIosRoute(async (req, res) => {
  res.json(await service.getAudit(req.ios, req.query));
}));

router.use(iosErrorMiddleware);

export default router;
