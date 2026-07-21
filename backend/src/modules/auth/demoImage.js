import zlib from "zlib";

// Gera um PNG de cor sólida (RGB) sem depender de libs externas nem de rede.
// Usado para "chumbar" as fotos antes/depois do portfólio da conta demo.
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// Cor sólida com uma faixa horizontal mais clara no topo (dá leve sensação de
// "foto" em vez de bloco chapado). w×h em pixels, cor base [r,g,b].
export function solidPng(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3); // 1 byte filter + pixels
    // faixa superior (20%) 25% mais clara
    const factor = y < h * 0.2 ? 1.25 : 1;
    const cr = Math.min(255, Math.round(r * factor));
    const cg = Math.min(255, Math.round(g * factor));
    const cb = Math.min(255, Math.round(b * factor));
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = cr;
      row[1 + x * 3 + 1] = cg;
      row[1 + x * 3 + 2] = cb;
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// Paleta de pares (antes = tom mais opaco, depois = tom mais vivo/claro).
export const DEMO_PORTFOLIO_COLORS = [
  { before: [150, 120, 110], after: [210, 180, 165] }, // pele
  { before: [120, 110, 130], after: [180, 165, 190] }, // arroxeado
  { before: [110, 130, 120], after: [165, 200, 185] }, // esverdeado
];
