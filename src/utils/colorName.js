// Nombre en español del color más cercano. Usa la distancia "redmean", una
// aproximación barata a cómo percibe el ojo la diferencia entre colores.
const NAMED_COLORS = [
  ['Negro', '#1C1C1C'], ['Blanco', '#F5F5F2'], ['Gris', '#8A8A8A'], ['Gris oscuro', '#4A4A4A'],
  ['Beige', '#D9C7A7'], ['Café', '#6F4E37'], ['Camel', '#C19A6B'], ['Rojo', '#C0392B'],
  ['Vino tinto', '#6B2F3A'], ['Rosado', '#E8A0B4'], ['Naranja', '#E67E22'], ['Amarillo', '#F1C40F'],
  ['Mostaza', '#C9A227'], ['Verde', '#27AE60'], ['Verde oliva', '#6B7340'], ['Verde oscuro', '#1E5631'],
  ['Azul', '#2E5BCC'], ['Azul claro', '#8EB8E5'], ['Azul marino', '#1F2A44'], ['Jean', '#3B4E6B'],
  ['Morado', '#7D3C98'], ['Lila', '#B9A2D8'],
];

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function distance(a, b) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

function colorName(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) return 'Sin detectar';
  let best = NAMED_COLORS[0];
  for (const entry of NAMED_COLORS) {
    if (distance(hex, entry[1]) < distance(hex, best[1])) best = entry;
  }
  return best[0];
}

module.exports = { colorName };