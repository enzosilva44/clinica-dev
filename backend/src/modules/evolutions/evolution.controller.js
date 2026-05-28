import * as evolutionService from "./evolution.service.js";

export async function create(req, res) {
  try {
    const evolution =
      await evolutionService.create(
        req.body,
        req.user.id
      );

    return res.status(201).json(
      evolution
    );
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function findByPatient(
  req,
  res
) {
  try {
    const evolutions =
      await evolutionService.findByPatient(
        req.params.patientId,
        req.user.id
      );

    return res.json(evolutions);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}