import * as procedureService from "./procedure.service.js";

export async function findAll(
  req,
  res
) {
  try {
    console.log(
      "REQ USER:",
      req.user
    );

    const procedures =
      await procedureService.findAll(
        req.user.id
      );

    console.log(
      "PROCEDURES:",
      procedures
    );

    return res.json(
      procedures
    );
  } catch (error) {
    console.log(
      "ERRO FIND ALL:"
    );

    console.log(error);

    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function create(
  req,
  res
) {
  try {
    const procedure =
      await procedureService.create(
        req.body,
        req.user.id
      );

    return res.status(201).json(
      procedure
    );
  } catch (error) {
    console.log(error);

    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function remove(
  req,
  res
) {
  try {
    await procedureService.remove(
      req.params.id
    );

    return res
      .status(204)
      .send();
  } catch (error) {
    console.log(error);

    return res.status(400).json({
      error: error.message,
    });
  }
}

export async function update(
  req,
  res
) {
  try {
    const procedure =
      await procedureService.update(
        req.params.id,
        req.body
      );

    return res.json(
      procedure
    );
  } catch (error) {
    console.log(error);

    return res.status(400).json({
      error: error.message,
    });
  }
}