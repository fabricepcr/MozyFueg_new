/**
 * Checks if delivery is currently open based on DeliverySettings entity data.
 * @param {object|null} settings - The DeliverySettings record (or null)
 * @returns {boolean}
 */
export function isDeliveryOpen(settings) {
  if (!settings) return true; // default to open if no settings configured

  if (settings.mode === 'manual') {
    return settings.manual_active !== false;
  }

  if (settings.mode === 'schedule') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const daySchedule = settings.schedule?.[dayName];

    if (!daySchedule?.enabled || !daySchedule.slots?.length) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return daySchedule.slots.some(slot => {
      const [openH, openM] = (slot.open || '00:00').split(':').map(Number);
      const [closeH, closeM] = (slot.close || '00:00').split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    });
  }

  return true;
}