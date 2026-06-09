import * as transactionService from "./transaction.service.js";

export async function findAll(req, res) {
  try {
    const transactions = await transactionService.findAll(req.user.id, req.query);
    return res.json(transactions);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getSummary(req, res) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const summary = await transactionService.getSummary(req.user.id, month);
    return res.json(summary);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getAnalytics(req, res) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const data = await transactionService.getAnalytics(req.user.id, month);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getUpcoming(req, res) {
  try {
    const data = await transactionService.getUpcoming(req.user.id);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function create(req, res) {
  try {
    const transaction = await transactionService.create(req.user.id, req.body);
    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function update(req, res) {
  try {
    const transaction = await transactionService.update(req.params.id, req.user.id, req.body);
    return res.json(transaction);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function approve(req, res) {
  try {
    const transaction = await transactionService.approve(req.params.id, req.user.id, req.body);
    return res.json(transaction);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function cancel(req, res) {
  try {
    const transaction = await transactionService.cancel(req.params.id, req.user.id);
    return res.json(transaction);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function remove(req, res) {
  try {
    await transactionService.remove(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
