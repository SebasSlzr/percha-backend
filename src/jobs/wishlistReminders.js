const cron = require('node-cron');
const User = require('../models/User');
const WishlistItem = require('../models/WishlistItem');
const { sendPush } = require('../services/push');

// Reglas (configurables por variables de entorno):
//  - Solo deseos sin comprar con al menos REMINDER_MIN_AGE (72 h = 3 días).
//  - El mismo deseo no se recuerda otra vez antes de REMINDER_REPEAT (168 h = 7 días).
//  - Como máximo un recordatorio por usuario en cada ejecución.
//  - Solo usuarios con token y con wishlistReminders activado.
// Para la demo: REMINDER_UNIT=minutes y REMINDER_CRON="* * * * *" (todo en minutos).
const unitMs = () => (process.env.REMINDER_UNIT === 'minutes' ? 60 * 1000 : 60 * 60 * 1000);
const minAge = () => Number(process.env.REMINDER_MIN_AGE_HOURS || 72) * unitMs();
const repeatAfter = () => Number(process.env.REMINDER_REPEAT_HOURS || 168) * unitMs();

function message(item) {
  const days = Math.floor((Date.now() - item.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const when = days >= 1 ? `hace ${days} ${days === 1 ? 'día' : 'días'}` : 'hace poco';
  const where = item.store ? ` en ${item.store}` : '';
  return {
    title: `¿Todavía quieres «${item.name}»?`,
    body: `La guardaste ${when}${where}. Toca para ver con qué combina.`,
    data: { kind: 'wishlist-reminder', url: `/wishlist/${item._id}` },
  };
}

let running = false;

async function runWishlistReminders() {
  if (running) return 0; // evita dos ejecuciones al mismo tiempo
  running = true;
  let sent = 0;
  try {
    const now = Date.now();
    const users = await User.find({ pushToken: { $ne: null }, wishlistReminders: { $ne: false } }).select('_id pushToken');

    for (const user of users) {
      const item = await WishlistItem.findOne({
        owner: user._id,
        purchased: false,
        createdAt: { $lte: new Date(now - minAge()) },
        $or: [{ lastRemindedAt: null }, { lastRemindedAt: { $lte: new Date(now - repeatAfter()) } }],
      }).sort({ createdAt: 1 });
      if (!item) continue;

      if (await sendPush({ to: user.pushToken, ...message(item) })) {
        await WishlistItem.updateOne({ _id: item._id }, { lastRemindedAt: new Date() });
        sent += 1;
      }
    }
    if (sent > 0) console.log(`🔔 Recordatorios de wishlist enviados: ${sent}`);
  } catch (error) {
    console.error('Error en el job de recordatorios:', error.message);
  } finally {
    running = false;
  }
  return sent;
}

function startWishlistReminders() {
  const schedule = process.env.REMINDER_CRON || '0 * * * *'; // cada hora, en punto
  cron.schedule(schedule, runWishlistReminders);
  console.log(`⏰ Job de recordatorios programado (${schedule})`);
}

module.exports = { startWishlistReminders, runWishlistReminders };