import * as productService from "./product.service.js";
import { sanitizeError } from "../../shared/errors/sanitizeError.js";

export async function create(req, res) {
  try {
    const product = await productService.create(req.body, req.user.id);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function findAll(req, res) {
  try {
    const products = await productService.findAll(req.user.id);
    return res.json(products);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function update(req, res) {
  try {
    const product = await productService.update(req.params.id, req.user.id, req.body);
    return res.json(product);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function findLowStock(req, res) {
  try {
    const products = await productService.findLowStock(req.user.id);
    return res.json(products);
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}

export async function remove(req, res) {
  try {
    await productService.remove(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: sanitizeError(error) });
  }
}
