import * as budgetService from "./budget.service.js";

export async function findByPatient(req, res) {
  try {
    const budgets = await budgetService.findByPatient(
      req.params.patientId,
      req.user.id
    );

    return res.json(budgets);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function create(req, res) {
  try {
    if (!req.body.title) {
      return res.status(400).json({ error: "Título obrigatório" });
    }

    if (!req.body.patientId) {
      return res.status(400).json({ error: "Paciente obrigatório" });
    }

    if (!req.body.items?.length) {
      return res.status(400).json({ error: "Adicione ao menos um item" });
    }

    const budget = await budgetService.create(req.body, req.user.id);
    return res.status(201).json(budget);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function remove(req, res) {
  try {
    await budgetService.remove(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
