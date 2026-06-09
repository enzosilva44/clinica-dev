import * as local from "./local.storage.js";
import * as s3 from "./s3.storage.js";

const provider = process.env.STORAGE_PROVIDER === "s3" ? s3 : local;

export const { saveFile, getFile, fileExists, deleteFile, getPublicUrl } = provider;
