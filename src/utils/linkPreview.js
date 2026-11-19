const dns = require('dns').promises;
const net = require('net');
const cheerio = require('cheerio');

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

// ---------- Protección SSRF ----------
// El servidor descarga páginas que manda la usuaria. Sin esta protección, alguien
// podría pedirle que lea direcciones internas (localhost, la red privada, la
// metadata del proveedor de nube). Se rechaza cualquier IP que no sea pública.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||   // red compartida del proveedor
      (a === 169 && b === 254) ||             // link-local y metadata de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                                 // multicast y reservadas
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7)); // IPv4 dentro de IPv6
  return (
    v6 === '::' || v6 === '::1' ||
    v6.startsWith('fc') || v6.startsWith('fd') || // únicas locales
    v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || // link-local
    v6.startsWith('ff')                           // multicast
  );
}

class LinkError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function assertPublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new LinkError(400, 'El link no es válido');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new LinkError(400, 'El link debe empezar por http:// o https://');
  }
  if (url.username || url.password) throw new LinkError(400, 'El link no es válido');
  if (url.port && !['80', '443'].includes(url.port)) throw new LinkError(400, 'El link no es válido');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new LinkError(422, 'No encontramos esa página');
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new LinkError(400, 'Ese link apunta a una dirección no permitida');
  }
  return url;
}

// Descarga el HTML siguiendo como máximo 3 redirecciones (cada una se vuelve a
// validar), con tiempo máximo y límite de tamaño.
async function fetchHtml(rawUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let url = await assertPublicUrl(rawUrl);
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es-CO,es;q=0.9', Accept: 'text/html' },
      });

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        url = await assertPublicUrl(new URL(response.headers.get('location'), url).toString());
        continue;
      }
      if (!response.ok) throw new LinkError(422, 'La página no respondió');
      if (!(response.headers.get('content-type') || '').includes('text/html')) {
        throw new LinkError(422, 'Ese link no es una página web');
      }

      // Lee el cuerpo por partes y corta si supera el límite.
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: url };
    }
    throw new LinkError(422, 'El link redirige demasiadas veces');
  } catch (error) {
    if (error instanceof LinkError) throw error;
    if (error.name === 'AbortError') throw new LinkError(422, 'La página tardó demasiado en responder');
    throw new LinkError(422, 'No pudimos abrir ese link');
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Lectura de la página (funciones puras) ----------

// "$129.900", "129.900,00", "129,900.00", "129900" -> 129900
function parsePrice(value) {
  if (value === undefined || value === null) return null;
  let text = String(value).replace(/[^\d.,]/g, '');
  if (!text) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
  else text = text.replace(',', '.');
  const number = Math.round(Number(text));
  return Number.isFinite(number) && number > 0 && number < 100000000 ? number : null;
}

const CATEGORY_KEYWORDS = [
  ['Vestido', ['vestido', 'dress', 'enterizo']],
  ['Chaqueta', ['chaqueta', 'jacket', 'chaquet', 'buzo', 'hoodie', 'saco', 'abrigo', 'blazer', 'sueter', 'sweater', 'cardigan', 'chompa']],
  ['Pantalón', ['pantalon', 'jean', 'jogger', 'short', 'bermuda', 'falda', 'leggin', 'trousers', 'pants']],
  ['Zapatos', ['zapato', 'tenis', 'sneaker', 'bota', 'sandalia', 'mocasin', 'calzado', 'shoe', 'botin']],
  ['Camiseta', ['camiseta', 'camisa', 'blusa', 'top', 'polo', 't-shirt', 'tshirt', 'crop', 'body', 'esqueleto']],
  ['Accesorio', ['gorra', 'sombrero', 'bolso', 'cartera', 'cinturon', 'bufanda', 'collar', 'arete', 'reloj', 'gafas', 'morral', 'cap']],
];

function guessCategory(title) {
  if (!title) return null;
  const text = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some((word) => new RegExp(`\\b${word}`).test(text))) return category;
  }
  return null;
}

// Busca un objeto Product en los bloques JSON-LD (datos estructurados de tiendas).
function findJsonLdProduct($) {
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const queue = Array.isArray(data) ? [...data] : [data];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        nodes.push(node);
        if (Array.isArray(node['@graph'])) queue.push(...node['@graph']);
      }
    } catch {
      // JSON-LD mal formado: se ignora
    }
  });
  return nodes.find((node) => [].concat(node['@type']).includes('Product')) || null;
}

function firstImage(value) {
  if (!value) return null;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (typeof value === 'object') return value.url || value.contentUrl || null;
  return String(value);
}

// Extrae nombre, tienda, precio, categoría y URL de la imagen a partir del HTML.
function extractPreview(html, pageUrl) {
  const $ = cheerio.load(html);
  const meta = (key) =>
    ($(`meta[property="${key}"]`).attr('content') || $(`meta[name="${key}"]`).attr('content') || '').trim() || null;
  const product = findJsonLdProduct($);
  const offer = product && [].concat(product.offers || [])[0];

  const rawName = (product && product.name) || meta('og:title') || meta('twitter:title') || $('title').first().text().trim() || null;
  const name = rawName ? rawName.replace(/\s+/g, ' ').slice(0, 80) : null;

  const host = new URL(pageUrl).hostname.replace(/^www\./, '');
  const store = (meta('og:site_name') || (product && product.brand && (product.brand.name || product.brand)) || host || '')
    .toString()
    .slice(0, 60) || null;

  const price = parsePrice(
    meta('product:price:amount') || meta('og:price:amount') ||
    (offer && (offer.price || offer.lowPrice)) ||
    $('[itemprop="price"]').attr('content')
  );

  let imageUrl = meta('og:image:secure_url') || meta('og:image') || meta('twitter:image') || firstImage(product && product.image);
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
      if (!/^https?:/.test(imageUrl)) imageUrl = null;
    } catch {
      imageUrl = null;
    }
  }

  return { name, store, price, category: guessCategory(name), imageUrl };
}

module.exports = { fetchHtml, extractPreview, assertPublicUrl, isPrivateIp, parsePrice, guessCategory, LinkError };