(async () => {
  const images = [
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Amsterdam-WA0022.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Argentina-WA0017.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Atun-WA0042.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Banana%20y%20canela-WA0040.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Barbacoa-WA0052.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Calabresa-WA0035.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Calabresaespecial.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Campera.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Caprese-WA0024.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Carioca-WA0046.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Carnivora-WA0009.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Catalana-WA0033(1).jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Crujiente-WA0013.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Cuatroquesos.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Del%20chef-WA0015.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Doritos.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Dubai-WA0038.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Frango%20catupiry%20.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Funghi-WA0044.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Granjera-WA0048.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Hawaiana%20Fuego-WA0006.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Iberica.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/La%20mafia.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/M%26Ms.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Mafiosa.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Marguerita.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Mozzarella-WA0021.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Pepperoni%20.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Picana-WA0037.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Pina%20Nevada-WA0039.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Pizzaiolo-WA0011.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Portuguesa-WA0041.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Putanesca.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Ruffles-WA0030.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Sensacion-WA0051.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Strogonoff-WA0019.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Tomateseco.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Uva%20trufada-WA0043.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/Vegetariana.png",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/agua-mineral-veri-330-ml-pack-35-botellas.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/aquarius%20limon.webp",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/aquarius%20naranja.webp",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/coca%20cola%20zero.webp",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/fanta%20de%20naranja.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/fanta%20limon.webp",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/fusie%20tea.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/guarana%20antartica.jpeg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/lata%20coca%20cola.jpg",
    "https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/sprite.webp"
  ];

  let ok = 0, failed = [];
  for (const url of images) {
    try {
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) { failed.push(url); console.warn('SKIP (no cache):', url); continue; }
      const blob = await resp.blob();
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const r = await fetch('/api/admin/migrateImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl: url, base64, contentType: blob.type })
      });
      const j = await r.json();
      if (j.success) { ok++; console.log(`✅ ${ok}/${images.length}`, url.split('/').pop()); }
      else { failed.push(url); console.error('ERROR:', j.error, url); }
    } catch(e) { failed.push(url); console.error('CATCH:', e.message, url); }
  }
  console.log(`\nDone. ${ok} migrated, ${failed.length} failed.`);
  if (failed.length) console.log('Failed:', failed);
})();
