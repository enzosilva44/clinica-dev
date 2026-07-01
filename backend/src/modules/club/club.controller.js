import * as clubService from "./club.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

// Planos
export async function findAllPlans(req, res) {
  try {
    return res.json(await clubService.findAllPlans(req.user.id));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
export async function createPlan(req, res) {
  try {
    return res.status(201).json(await clubService.createPlan(req.user.id, req.body));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
export async function updatePlan(req, res) {
  try {
    return res.json(await clubService.updatePlan(req.params.id, req.user.id, req.body));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
export async function deletePlan(req, res) {
  try {
    await clubService.deletePlan(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}

// Membros
export async function findAllMembers(req, res) {
  try {
    return res.json(await clubService.findAllMembers(req.user.id, req.query));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
export async function createMember(req, res) {
  try {
    return res.status(201).json(await clubService.createMember(req.user.id, req.body));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
export async function updateMemberStatus(req, res) {
  try {
    return res.json(await clubService.updateMemberStatus(req.params.id, req.user.id, req.body.status));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}

// Aplicações
export async function registerApplication(req, res) {
  try {
    return res.status(201).json(
      await clubService.registerApplication(req.params.memberId, req.user.id, req.body)
    );
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}

// Alertas
export async function getAlerts(req, res) {
  try {
    return res.json(await clubService.getAlerts(req.user.id));
  } catch (e) { return res.status(400).json({ error: sanitizeError(e) }); }
}
