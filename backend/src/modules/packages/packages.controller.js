import * as packagesService from "./packages.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

export async function getOverview(req, res) {
  try {
    return res.json(
      await packagesService.getOverview(req.user.id, { patientId: req.query.patientId })
    );
  } catch (e) {
    return res.status(400).json({ error: sanitizeError(e) });
  }
}
