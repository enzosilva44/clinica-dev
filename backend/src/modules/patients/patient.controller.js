import * as patientService from "./patient.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

  export async function create(req, res) {
    try {
      const patient = await patientService.create(
        req.body,
        req.user.id
      );

      return res.status(201).json(patient);
    } catch (error) {
      return res.status(400).json({
        error: sanitizeError(error),
      });
    }
  }

  export async function findOne(req, res) {
    try {

      const patient =
        await patientService.findOne(
          req.params.id,
          req.user.id
        );

      return res.json(patient);
    } catch (error) {
      console.log(error);

      return res.status(400).json({
        error: sanitizeError(error),
      });
    }
  }

  export async function findAll(req, res) {
    try {
      const {
        page = 1,
        search = "",
        status = "active",
        sortBy = "recent",
      } = req.query;

      const patients =
        await patientService.findAll({
          userId: req.user.id,

          page: Number(page),

          search,

          status,

          sortBy,
        });

      return res.json(patients);
    } catch (error) {
      return res.status(400).json({
        error: sanitizeError(error),
      });
    }
  }

  export async function findById(req, res) {
    try {
      const patient = await patientService.findById(
        req.params.id,
        req.user
      );

      return res.json(patient);
    } catch (error) {
      return res.status(400).json({
        error: sanitizeError(error),
      });
    }
  }

  export async function update(req, res) {
    try {
      const patient = await patientService.update(
        req.params.id,
        req.body,
        req.user.id
      );
    
      return res.json(patient);
    } catch (error) {
      return res.status(400).json({
        error: sanitizeError(error),
      });
    }
  }

  export async function checkImport(req, res) {
  try {
    const { patients } = req.body;
    if (!Array.isArray(patients) || patients.length === 0)
      return res.status(400).json({ error: "Nenhum paciente enviado." });
    const result = await patientService.checkImport(patients, req.user.id);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function importBulk(req, res) {
  try {
    const { patients } = req.body;
    if (!Array.isArray(patients) || patients.length === 0)
      return res.status(400).json({ error: "Nenhum paciente enviado." });
    const result = await patientService.importBulk(patients, req.user.id);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function remove(req, res) {
  try {
    const response = await patientService.remove(
      req.params.id,
      req.user.id
    );

    return res.json(response);
  } catch (error) {
    return res.status(400).json({
      error: sanitizeError(error),
    });
  }
}