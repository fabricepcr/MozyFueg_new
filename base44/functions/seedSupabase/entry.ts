Deno.serve(async (_req) => {
  try {
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') ?? '';
    const supabaseUrl = rawUrl.replace(/\/rest\/v1$/, '');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    const menuItems = [
      // ── PIZZAS SALADAS (33) ──
      { name: 'Pizza Strogonoff', description: 'Ternera en salsa de tomate y nata con patata paja', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 1, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/af1610211_image.png' },
      { name: 'Pizza Cuatro Quesos', description: 'Mozzarella, cheddar, provolone, gorgonzola y orégano', price: 14.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 2, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/53e7eb859_image.png' },
      { name: 'Pizza Amsterdam', description: 'Longaniza Calabresa, cheddar, cebolla morada y orégano', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 3, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/8dcaa3292_image.png' },
      { name: 'Pizza Argentina', description: 'Tiras de ternera, tomate cherry, pimiento verde, cebolla morada y cheddar', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 4, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/efc7a4723_image.png' },
      { name: 'Pizza Carioca', description: 'Bacon, maíz dulce, requesón tipo catupiry y orégano', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 5, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/82114fe21_image.png' },
      { name: 'Pizza Granjera', description: 'Bacon, huevo duro y orégano', price: 14.90, price_23cm: 10.90, category: 'pizzas', available: true, sort_order: 6, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/97035e6e8_image.png' },
      { name: 'Pizza Campera', description: 'Pollo mechado, brócolis y requesón tipo catupiry', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 7, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/fa652dc4b_image.png' },
      { name: 'Pizza Calabresa', description: 'Longaniza Calabresa y pimienta calabresa', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 8, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/9af6c7854_image.png' },
      { name: 'Pizza Del Chef', description: 'Tiras de ternera, maíz dulce, gorgonzola, cebolla morada, tomate cherry y requesón tipo catupiry', price: 20.90, price_23cm: 14.90, category: 'pizzas', available: true, sort_order: 9, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/a01b206ed_image.png' },
      { name: 'Pizza Picaña', description: 'Picaña con alioli', price: 17.90, price_23cm: 12.90, category: 'pizzas', available: true, sort_order: 10, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/59806f5b0_image.png' },
      { name: 'Pizza La Mafia', description: 'Bacon, brócolis y requesón tipo catupiry', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 11, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/0f6604406_image.png' },
      { name: 'Pizza Hawaiana Fuego', description: 'Lomo adobado y trozos de piña', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 12, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/0174551c8_HawaianaFuego-WA0006.jpg' },
      { name: 'Pizza Mafiosa', description: 'Pollo mechado, bacon, cheddar, cebolla morada y orégano', price: 19.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 13, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/4cb9bd6e2_image.png' },
      { name: 'Pizza Marguerita', description: 'Doble de salsa de tomate y albahaca fresca', price: 11.90, price_23cm: 8.90, category: 'pizzas', available: true, sort_order: 14, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/808d4bea9_image.png' },
      { name: 'Pizza Mozzarella', description: 'Doble de mozzarella y orégano', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 15, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/456506693_image.png' },
      { name: 'Pizza Portuguesa', description: 'Jamón dulce, tomate cherry, guisantes, maíz dulce, aceitunas verdes, pimiento verde, huevo duro, cebolla morada y orégano', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 16, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/3c1184830_image.png' },
      { name: 'Pizza Tomate Seco', description: 'Tomate seco, rúcula y lascas de grana padano', price: 11.90, price_23cm: 8.90, category: 'pizzas', available: true, sort_order: 17, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/43d1e4b20_image.png' },
      { name: 'Pizza Calabresa Especial', description: 'Longaniza Calabresa, bacon, huevo duro y orégano', price: 20.90, price_23cm: 14.90, category: 'pizzas', available: true, sort_order: 18, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/b22634ee9_image.png' },
      { name: 'Pizza Vegetariana', description: 'Tomate cherry, cebolla morada, brócolis, maíz dulce y orégano', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 19, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/9696379f9_image.png' },
      { name: 'Pizza Crujiente', description: 'Tiras de ternera, cebolla frita y requesón tipo catupiry', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 20, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/33793ac65_image.png' },
      { name: 'Pizza Ruffles', description: 'Tiras de ternera, ruffles y requesón tipo catupiry', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 21, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/0ef97055e_image.png' },
      { name: 'Pizza Pizzaiolo', description: 'Tiras de ternera, bacon, cheddar, cebolla morada y salsa barbacoa', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 22, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/809f5bd16_image.png' },
      { name: 'Pizza Pepperoni', description: 'Pepperoni y mozzarella', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 23, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/cf83a25ce_image.png' },
      { name: 'Pizza Carnívora', description: 'Tiras de ternera, longaniza calabresa, bacon y orégano', price: 17.90, price_23cm: 12.90, category: 'pizzas', available: true, sort_order: 24, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/be1fc5dfa_image.png' },
      { name: 'Pizza Putanesca', description: 'Anchoas, lascas de grana padano, olivas negras y alcaparras', price: 14.90, price_23cm: 10.90, category: 'pizzas', available: true, sort_order: 25, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/be08dffed_image.png' },
      { name: 'Pizza Atún', description: 'Atún, pimiento verde y olivas negras', price: 14.90, price_23cm: 10.90, category: 'pizzas', available: true, sort_order: 26, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/aac414f36_Atun-WA0042.jpg' },
      { name: 'Pizza Ibérica', description: 'Chorizo ibérico y olivas negras', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 27, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/9865e0c67_image.png' },
      { name: 'Pizza Funghi', description: 'Base de salsa funghi, champiñones y aceite de trufa', price: 14.90, price_23cm: 10.90, category: 'pizzas', available: true, sort_order: 28, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/5e9321858_image.png' },
      { name: 'Pizza Catalana', description: 'Butifarra del pagès y cebolla caramelizada', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 29, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/42d3b7303_Catalana-WA00331.jpg' },
      { name: 'Pizza Barbacoa', description: 'Bacon, pollo, picaña y salsa barbacoa', price: 16.90, price_23cm: 11.90, category: 'pizzas', available: true, sort_order: 30, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/26878e9f6_image.png' },
      { name: 'Pizza Frango Catupiry', description: 'Pollo mechado y requesón tipo catupiry', price: 18.90, price_23cm: 13.90, category: 'pizzas', available: true, sort_order: 31, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/610befc44_image.png' },
      { name: 'Pizza Caprese', description: 'Tomate cherry, aceite de albahaca y perlas de mozzarella', price: 13.90, price_23cm: 9.90, category: 'pizzas', available: true, sort_order: 32, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/bafa70420_Caprese-WA0024.jpg' },
      { name: 'Pizza Doritos', description: 'Cuatro quesos con Doritos', price: 17.90, price_23cm: 12.90, category: 'pizzas', available: true, sort_order: 33, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/1f36f7247_image.png' },

      // ── PIZZAS DULCES (6) ──
      { name: 'Pizza Piña Nevada', description: 'Crema de chocolate, chocolate rallado, trozos de piña y coco rallado', price: 15.90, price_23cm: 11.90, category: 'pizzas_dulces', available: true, sort_order: 1, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/77bceb9c1_PinaNevada-WA0039.jpg' },
      { name: 'Pizza Dubai', description: 'Crema de pistacho con pasta Kadayif, chocolate rallado y pistachos', price: 18.90, price_23cm: 13.90, category: 'pizzas_dulces', available: true, sort_order: 2, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/9db47be9b_Dubai-WA0038.jpg' },
      { name: 'Pizza Sensación', description: 'Crema de chocolate, chocolate rallado y fresas', price: 17.90, price_23cm: 12.90, category: 'pizzas_dulces', available: true, sort_order: 3, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/f4764b067_Sensacion-WA0051.jpg' },
      { name: 'Pizza Uva Trufada', description: 'Crema de chocolate, chocolate rallado, uvas verdes y leche nido', price: 17.90, price_23cm: 12.90, category: 'pizzas_dulces', available: true, sort_order: 4, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/81e927e7e_Uvatrufada-WA0043.jpg' },
      { name: 'Pizza M&Ms', description: 'Crema de chocolate, chocolate rallado y M&Ms', price: 18.90, price_23cm: 13.90, category: 'pizzas_dulces', available: true, sort_order: 5, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/d4de63829_MMs.png' },
      { name: 'Pizza Banana y Canela', description: 'Banana y canela', price: 10.90, price_23cm: 7.90, category: 'pizzas_dulces', available: true, sort_order: 6, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/04bec89f5_image.png' },

      // ── BEBIDAS ──
      { name: 'Coca-Cola', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 1, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/c1ed3cefa_45355_03.webp' },
      { name: 'Coca-Cola Zero', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 2, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/13cba803d_coca-cola-zero-lata-33cl-pack-8-unidades.jpg' },
      { name: 'Agua sin gas', description: 'Botella', price: 1.60, price_23cm: null, category: 'bebidas', available: true, sort_order: 3, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/02da3595e_agua-mineral-veri-330-ml-pack-35-botellas.jpg' },
      { name: 'Nestea', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 4, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/2a21a14b4_refresco-te-limon-fuze-tea-original-33cl-pack-24-latas1.jpg' },
      { name: 'Guaraná Antarctica', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 5, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/a696ac842_225e213ed_Guarana.jpg' },
      { name: 'Guaraná Antarctica Zero', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 6, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/fc5d92f33_d78807b48_Guaranazero.jpg' },
      { name: 'Aquarius Naranja', description: 'Lata 33cl', price: 2.70, price_23cm: null, category: 'bebidas', available: true, sort_order: 7, image_url: 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/3aedea9cd_image.png' },
    ];

    const deleteHeaders = { ...headers, 'Prefer': 'count=exact' };
    await fetch(`${supabaseUrl}/rest/v1/menu_items?name=neq.ZZZNEVEREXISTS`, { method: 'DELETE', headers: deleteHeaders });
    await fetch(`${supabaseUrl}/rest/v1/store_settings?store_open=neq.ZZZNEVEREXISTS`, { method: 'DELETE', headers: deleteHeaders });
    await fetch(`${supabaseUrl}/rest/v1/delivery_settings?mode=neq.ZZZNEVEREXISTS`, { method: 'DELETE', headers: deleteHeaders });

    const insertMenuRes = await fetch(`${supabaseUrl}/rest/v1/menu_items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(menuItems),
    });
    const insertMenuText = await insertMenuRes.text();
    console.log('insert menu status:', insertMenuRes.status, insertMenuText.slice(0, 200));

    if (!insertMenuRes.ok) {
      return Response.json({ error: 'Failed to insert menu_items', details: insertMenuText }, { status: 500 });
    }

    await fetch(`${supabaseUrl}/rest/v1/store_settings`, {
      method: 'POST', headers, body: JSON.stringify([{ store_open: true }]),
    });

    await fetch(`${supabaseUrl}/rest/v1/delivery_settings`, {
      method: 'POST', headers, body: JSON.stringify([{
        mode: 'manual', manual_active: true,
        schedule: Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => [d, { enabled: false, slots: [{ open: '19:00', close: '23:00' }] }]))
      }]),
    });

    return Response.json({ success: true, inserted: menuItems.length });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});