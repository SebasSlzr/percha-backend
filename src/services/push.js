const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Envía una notificación por el servicio de Expo, que la reenvía a FCM (Android).
// Nunca lanza errores: si falla, devuelve false y lo registra en el log.
async function sendPush({ to, title, body, data }) {
  try {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ to, title, body, data, sound: 'default', priority: 'high', channelId: 'default' }]),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    const ticket = Array.isArray(result.data) ? result.data[0] : null;

    if (ticket?.status === 'ok') return true;

    // La app se desinstaló o el token caducó: se borra para no seguir intentando.
    if (ticket?.details?.error === 'DeviceNotRegistered') {
      await User.updateOne({ pushToken: to }, { pushToken: null });
    }
    console.error('Push rechazado por Expo:', ticket?.message || result.errors?.[0]?.message || response.status);
    return false;
  } catch (error) {
    console.error('No se pudo enviar el push:', error.message);
    return false;
  }
}

module.exports = { sendPush };