import * as movementService from "./movement.service.js";

export async function findAll(req, res) {
  try {
    const { productId, startDate, endDate } = req.query;
    const data = await movementService.findAll(req.user.id, { productId, startDate, endDate });
    return res.json(data);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function findByProduct(req, res) {
  try {
    const movements = await movementService.findByProduct(req.params.id, req.user.id);
    return res.json(movements);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function create(req, res) {
  try {
    const movement = await movementService.create(req.params.id, req.user.id, req.body);
    return res.status(201).json(movement);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
