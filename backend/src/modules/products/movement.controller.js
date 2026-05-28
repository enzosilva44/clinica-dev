import * as movementService from "./movement.service.js";

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
