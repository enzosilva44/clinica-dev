export const TAG_LABELS = {
  fronte:      "fronte",
  glabela:     "glabela",
  periorbital: "periorbital",
  nariz:       "nariz",
  perioral:    "perioral",
  queixo:      "queixo",
  pescoco:     "pescoço",
  mandibula:   "mandíbula",
};

export const TAG_COLORS = {
  fronte:      "bg-blue-100 text-blue-700",
  glabela:     "bg-violet-100 text-violet-700",
  periorbital: "bg-sky-100 text-sky-700",
  nariz:       "bg-pink-100 text-pink-700",
  perioral:    "bg-orange-100 text-orange-700",
  queixo:      "bg-emerald-100 text-emerald-700",
  pescoco:     "bg-teal-100 text-teal-700",
  mandibula:   "bg-red-100 text-red-700",
};

export const FACIAL_MUSCLES = [
  { id: "frontal",          name: "Frontal",                       tag: "fronte",      color: "#2E6FA8", defaultUnits: 10, description: "Linhas horizontais da testa" },
  { id: "procero",          name: "Prócero",                       tag: "glabela",     color: "#7C5CBF", defaultUnits: 5,  description: "Ruga transversal na raiz do nariz" },
  { id: "corrugador",       name: "Corrugador do Supercílio",      tag: "glabela",     color: "#7C5CBF", defaultUnits: 8,  description: 'Rugas verticais entre as sobrancelhas ("11")' },
  { id: "dep_supercilio",   name: "Depressor do Supercílio",       tag: "glabela",     color: "#7C5CBF", defaultUnits: 4,  description: "Ptose da sobrancelha medial" },
  { id: "orbicular_pg",     name: "Orbicular do Olho",             tag: "periorbital", color: "#0EA5E9", defaultUnits: 6,  description: "Pés de galinha" },
  { id: "elevador_narina",  name: "Levantador do Lábio Superior",  tag: "nariz",       color: "#C45E8A", defaultUnits: 2,  description: "Levanta o lábio superior e dilata as narinas" },
  { id: "dep_septo",        name: "Depressor do Septo Nasal",      tag: "nariz",       color: "#C45E8A", defaultUnits: 4,  description: "Abaixa a ponta do nariz ao sorrir" },
  { id: "bunny_lines",      name: "Nasalis (Bunny Lines)",         tag: "nariz",       color: "#C45E8A", defaultUnits: 4,  description: "Linhas do coelho — laterais do nariz" },
  { id: "orbicular_boca",   name: "Orbicular da Boca",             tag: "perioral",    color: "#D4742A", defaultUnits: 4,  description: "Código de barras — rugas ao redor da boca" },
  { id: "dao",              name: "Depressor do Ângulo da Boca",   tag: "perioral",    color: "#D4742A", defaultUnits: 4,  description: "Canto da boca caído (DAO)" },
  { id: "elevador_labio",   name: "Elevador do Lábio Superior",    tag: "perioral",    color: "#D4742A", defaultUnits: 2,  description: "Lábio superior fino — lip flip" },
  { id: "risorio",          name: "Risório",                       tag: "perioral",    color: "#D4742A", defaultUnits: 2,  description: "Linha de sorriso lateral" },
  { id: "mentoniano",       name: "Mentoniano",                    tag: "queixo",      color: "#059669", defaultUnits: 6,  description: "Queixo com aspecto de casca de laranja" },
  { id: "platisma",         name: "Platisma",                      tag: "pescoco",     color: "#0D9488", defaultUnits: 8,  description: "Bandas platismais no pescoço" },
  { id: "masseter",         name: "Masseter",                      tag: "mandibula",   color: "#C0392B", defaultUnits: 25, description: "Bruxismo e definição mandibular" },
  { id: "temporal",         name: "Temporal",                      tag: "mandibula",   color: "#C0392B", defaultUnits: 15, description: "Auxiliar no tratamento do bruxismo" },
];

export const VIAL_PRESENTATIONS = ["50U", "100U", "200U", "300U", "500U"];
