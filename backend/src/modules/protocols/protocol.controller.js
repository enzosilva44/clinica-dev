import * as protocolService from "./protocol.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

export async function findAll(req, res) {
  try {
    return res.json(await protocolService.findAll(req.user.id));
  } catch (e) {
    return res.status(400).json({ error: sanitizeError(e) });
  }
}

export async function findById(req, res) {
  try {
    return res.json(await protocolService.findById(req.params.id, req.user.id));
  } catch (e) {
    return res.status(404).json({ error: sanitizeError(e) });
  }
}

export async function create(req, res) {
  try {
    return res.status(201).json(await protocolService.create(req.body, req.user.id));
  } catch (e) {
    return res.status(400).json({ error: sanitizeError(e) });
  }
}

export async function update(req, res) {
  try {
    return res.json(await protocolService.update(req.params.id, req.body, req.user.id));
  } catch (e) {
    return res.status(400).json({ error: sanitizeError(e) });
  }
}

export async function remove(req, res) {
  try {
    return res.json(await protocolService.remove(req.params.id, req.user.id));
  } catch (e) {
    return res.status(400).json({ error: sanitizeError(e) });
  }
}
