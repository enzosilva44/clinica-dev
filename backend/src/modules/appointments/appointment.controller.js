import * as appointmentService from "./appointment.service.js";

export async function create(req, res) {
  try {
    const appointment = await appointmentService.create(
      req.body,
      req.user
    );

    return res.status(201).json(appointment);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function findAll(req, res) {
  try {
    const appointments =
      await appointmentService.findAll(req.user);

    return res.json(appointments);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function getCalendar(req, res) {
  try {
    const { from, to, types } = req.query;
    const typesArr = types ? String(types).split(",").filter(Boolean) : null;
    const events = await appointmentService.getCalendar(req.user, { from, to, types: typesArr });
    return res.json(events);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function findById(req, res) {
  try {
    const appointment =
      await appointmentService.findById(
        req.params.id,
        req.user
      );

    return res.json(appointment);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function findByPatient(req, res) {
  try {
    const appointments = await appointmentService.findByPatient(
      req.params.patientId,
      req.user.id
    );
    return res.json(appointments);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function update(
  req,
  res
) {
  try {
    const appointment =
      await appointmentService.update(
        req.params.id,
        req.user.id,
        req.body
      );

    return res.json(appointment);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
}