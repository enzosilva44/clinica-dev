import * as service from "./stockRequest.service.js";

export async function findAll(req, res) {
  try {
    const { status } = req.query;
    const data = await service.findAll(req.user.id, { status });
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function create(req, res) {
  try {
    const data = await service.create(req.user.id, req.body);
    return res.status(201).json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function approve(req, res) {
  try {
    const data = await service.approve(req.params.id, req.user.id);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function reject(req, res) {
  try {
    const data = await service.reject(req.params.id, req.user.id);
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
