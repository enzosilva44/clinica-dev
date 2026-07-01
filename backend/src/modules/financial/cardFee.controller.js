import * as cardFeeService from "./cardFee.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

export async function list(req, res) {
  try {
    return res.json(await cardFeeService.list(req.user.id));
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function create(req, res) {
  try {
    return res.status(201).json(await cardFeeService.create(req.user.id, req.body));
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function update(req, res) {
  try {
    return res.json(await cardFeeService.update(req.user.id, req.params.id, req.body));
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function remove(req, res) {
  try {
    return res.json(await cardFeeService.remove(req.user.id, req.params.id));
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}
