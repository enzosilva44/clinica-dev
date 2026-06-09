import * as patientService from "./patient.service.js";

  export async function create(req, res) {
    try {
      const patient = await patientService.create(
        req.body,
        req.user.id
      );

      return res.status(201).json(patient);
    } catch (error) {
      return res.status(400).json({
        error: error.message,
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
        error: error.message,
      });
    }
  }

  export async function findAll(req, res) {
    try {
      const {
        page = 1,
        search = "",
        status = "active",
      } = req.query;

      const patients =
        await patientService.findAll({
          userId: req.user.id,

          page: Number(page),

          search,

          status,
        });

      return res.json(patients);
    } catch (error) {
      return res.status(400).json({
        error: error.message,
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
        error: error.message,
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
        error: error.message,
      });
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
      error: error.message,
    });
  }
}