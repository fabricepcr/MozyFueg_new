import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_PASSWORD = 'mozzarellayfuego123';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action, password, key, value } = body;

    const base44 = createClientFromRequest(req);

    // ── Public read-only ──────────────────────────────────────────────────────
    if (action === 'getPublicSettings') {
      const [storeArr, deliveryArr] = await Promise.all([
        base44.asServiceRole.entities.StoreSettings.list('-updated_date', 1),
        base44.asServiceRole.entities.DeliverySettings.list('-updated_date', 1),
      ]);
      const storeOpen = storeArr[0]?.store_open !== false;
      const deliveryActive = deliveryArr[0]?.manual_active !== false;
      const pickupActive = deliveryArr[0]?.pickup_active !== false;
      return Response.json({ data: { storeOpen, deliveryActive, pickupActive } });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (password !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── updateSetting — guarda un campo individual ────────────────────────────
    if (action === 'updateSetting') {
      const val = value === true || value === 'true';

      if (key === 'store_open') {
        const storeArr = await base44.asServiceRole.entities.StoreSettings.list('-updated_date', 1);
        if (storeArr.length > 0) {
          await base44.asServiceRole.entities.StoreSettings.update(storeArr[0].id, { store_open: val });
        } else {
          await base44.asServiceRole.entities.StoreSettings.create({ store_open: val, singleton_key: 'main' });
        }
        return Response.json({ data: { key, value: val } });
      }

      if (key === 'delivery_active' || key === 'pickup_active') {
        const deliveryArr = await base44.asServiceRole.entities.DeliverySettings.list('-updated_date', 1);
        const updates = {};
        if (key === 'delivery_active') updates.manual_active = val;
        if (key === 'pickup_active') updates.pickup_active = val;

        if (deliveryArr.length > 0) {
          await base44.asServiceRole.entities.DeliverySettings.update(deliveryArr[0].id, updates);
        } else {
          await base44.asServiceRole.entities.DeliverySettings.create({
            mode: 'manual',
            manual_active: key === 'delivery_active' ? val : true,
            pickup_active: key === 'pickup_active' ? val : true,
            singleton_key: 'main',
          });
        }
        return Response.json({ data: { key, value: val } });
      }

      return Response.json({ error: 'Unknown key' }, { status: 400 });
    }

    // ── updateAllSettings — guarda delivery y pickup en una sola llamada ─────
    if (action === 'updateAllSettings') {
      const deliveryVal = value?.delivery_active === true || value?.delivery_active === 'true';
      const pickupVal = value?.pickup_active === true || value?.pickup_active === 'true';

      const deliveryArr = await base44.asServiceRole.entities.DeliverySettings.list('-updated_date', 1);
      const updates = { manual_active: deliveryVal, pickup_active: pickupVal };

      if (deliveryArr.length > 0) {
        await base44.asServiceRole.entities.DeliverySettings.update(deliveryArr[0].id, updates);
      } else {
        await base44.asServiceRole.entities.DeliverySettings.create({
          mode: 'manual',
          singleton_key: 'main',
          ...updates,
        });
      }
      return Response.json({ data: { delivery_active: deliveryVal, pickup_active: pickupVal } });
    }

    // ── getDeliverySettings ──────────────────────────────────────────────────
    if (action === 'getDeliverySettings') {
      const deliveryArr = await base44.asServiceRole.entities.DeliverySettings.list('-updated_date', 1);
      const row = deliveryArr[0] || null;
      return Response.json({
        data: row ? {
          id: row.id,
          mode: row.mode || 'manual',
          manual_active: row.manual_active !== false,
          schedule: row.schedule || {},
        } : null,
      });
    }

    // ── updateDeliverySettings ───────────────────────────────────────────────
    if (action === 'updateDeliverySettings') {
      const { mode, manual_active, schedule } = body.data || {};
      const deliveryArr = await base44.asServiceRole.entities.DeliverySettings.list('-updated_date', 1);
      const updates: Record<string, unknown> = {};
      if (mode !== undefined) updates.mode = mode;
      if (manual_active !== undefined) updates.manual_active = manual_active;
      if (schedule !== undefined) updates.schedule = schedule;

      if (deliveryArr.length > 0) {
        await base44.asServiceRole.entities.DeliverySettings.update(deliveryArr[0].id, updates);
      } else {
        await base44.asServiceRole.entities.DeliverySettings.create({
          mode: mode || 'manual',
          manual_active: manual_active !== false,
          schedule: schedule || {},
          singleton_key: 'main',
        });
      }
      return Response.json({ data: { ok: true } });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('adminSettings error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});