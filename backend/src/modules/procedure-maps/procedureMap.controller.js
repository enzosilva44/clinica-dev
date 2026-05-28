import * as mapService from "./procedureMap.service.js";

export async function findByPatient(req, res) {
  try {
    return res.json(await mapService.findByPatient(req.params.patientId, req.user.id));
  } catch (e) { return res.status(400).json({ error: e.message }); }
}

export async function findById(req, res) {
  try {
    return res.json(await mapService.findById(req.params.id, req.user.id));
  } catch (e) { return res.status(400).json({ error: e.message }); }
}

export async function create(req, res) {
  try {
    return res.status(201).json(
      await mapService.create(req.params.patientId, req.user.id, req.body)
    );
  } catch (e) { return res.status(400).json({ error: e.message }); }
}

export async function update(req, res) {
  try {
    return res.json(await mapService.update(req.params.id, req.user.id, req.body));
  } catch (e) { return res.status(400).json({ error: e.message }); }
}

export async function remove(req, res) {
  try {
    await mapService.remove(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
