// Mapa de ingredientes removibles por pizza
// Todas las pizzas saladas llevan mozzarella y salsa de tomate (excepto Funghi que lleva salsa funghi)

export const PIZZA_REMOVABLE_INGREDIENTS = {
  'strogonoff': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin ternera', 'Sin patata paja',
  ],
  'cuatro quesos': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin cheddar', 'Sin provolone', 'Sin gorgonzola', 'Sin orégano',
  ],
  'amsterdam': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin longaniza calabresa', 'Sin cheddar', 'Sin cebolla morada', 'Sin orégano',
  ],
  'argentina': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin tomate cherry', 'Sin pimiento verde', 'Sin cebolla morada', 'Sin cheddar',
  ],
  'carioca': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin bacon', 'Sin maíz dulce', 'Sin requesón tipo catupiry', 'Sin orégano',
  ],
  'granjera': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin bacon', 'Sin huevo duro', 'Sin orégano',
  ],
  'campera': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin pollo mechado', 'Sin brócoli', 'Sin requesón tipo catupiry',
  ],
  'calabresa': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin longaniza calabresa', 'Sin pimienta calabresa',
  ],
  'del chef': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin maíz dulce', 'Sin gorgonzola',
    'Sin cebolla morada', 'Sin tomate cherry', 'Sin requesón tipo catupiry',
  ],
  'picaña': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin picaña', 'Sin alioli',
  ],
  'la mafia': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin bacon', 'Sin brócoli', 'Sin requesón tipo catupiry',
  ],
  'hawaiana fuego': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin lomo adobado', 'Sin piña',
  ],
  'mafiosa': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin pollo mechado', 'Sin bacon', 'Sin cheddar', 'Sin cebolla morada', 'Sin orégano',
  ],
  'marguerita': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin extra de salsa de tomate', 'Sin albahaca fresca',
  ],
  'mozzarella': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin extra de mozzarella', 'Sin orégano',
  ],
  'portuguesa': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin jamón dulce', 'Sin tomate cherry', 'Sin guisantes', 'Sin maíz dulce',
    'Sin aceitunas verdes', 'Sin pimiento verde', 'Sin huevo duro', 'Sin cebolla morada', 'Sin orégano',
  ],
  'tomate seco': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tomate seco', 'Sin rúcula', 'Sin grana padano',
  ],
  'calabresa especial': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin longaniza calabresa', 'Sin bacon', 'Sin huevo duro', 'Sin orégano',
  ],
  'vegetariana': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tomate cherry', 'Sin cebolla morada', 'Sin brócoli', 'Sin maíz dulce', 'Sin orégano',
  ],
  'crujiente': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin cebolla frita', 'Sin requesón tipo catupiry',
  ],
  'ruffles': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin ruffles', 'Sin requesón tipo catupiry',
  ],
  'pizzaiolo': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin bacon', 'Sin cheddar', 'Sin cebolla morada', 'Sin salsa barbacoa',
  ],
  'pepperoni': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin pepperoni',
  ],
  'carnívora': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tiras de ternera', 'Sin longaniza calabresa', 'Sin bacon', 'Sin orégano',
  ],
  'putanesca': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin anchoas', 'Sin grana padano', 'Sin olivas negras', 'Sin alcaparras',
  ],
  'atún': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin atún', 'Sin pimiento verde', 'Sin olivas negras',
  ],
  'ibérica': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin chorizo ibérico', 'Sin olivas negras',
  ],
  'funghi': [
    'Sin mozzarella', 'Sin base de salsa funghi',
    'Sin champiñones', 'Sin aceite de trufa',
  ],
  'catalana': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin butifarra del pagès', 'Sin cebolla caramelizada',
  ],
  'barbacoa': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin bacon', 'Sin pollo', 'Sin picaña', 'Sin salsa barbacoa',
  ],
  'frango catupiry': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin pollo mechado', 'Sin requesón tipo catupiry',
  ],
  'caprese': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin tomate cherry', 'Sin aceite de albahaca', 'Sin perlas de mozzarella',
  ],
  'doritos': [
    'Sin mozzarella', 'Sin base de salsa de tomate',
    'Sin cuatro quesos', 'Sin Doritos',
  ],
};

// Ingredientes de pizzas dulces: { removable: [], locked: [] }
// locked = NO se puede quitar (obligatorios), removable = opcionales
export const SWEET_PIZZA_INGREDIENTS = {
  'piña nevada': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin trozos de piña', 'Sin coco rallado'],
    locked: ['Crema de chocolate'],
  },
  'dubai': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin pistachos'],
    locked: ['Crema de pistacho con pasta kadaïf'],
  },
  'dubái': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin pistachos'],
    locked: ['Crema de pistacho con pasta kadaïf'],
  },
  'sensacion': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin fresas'],
    locked: ['Crema de chocolate'],
  },
  'sensación': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin fresas'],
    locked: ['Crema de chocolate'],
  },
  'uva extrafria': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin uvas verdes', 'Sin Leche Nido'],
    locked: ['Crema de chocolate'],
  },
  'uva extrafrí': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin uvas verdes', 'Sin Leche Nido'],
    locked: ['Crema de chocolate'],
  },
  'uva': {
    removable: ['Sin mozzarella', 'Sin chocolate rallado', 'Sin uvas verdes', 'Sin Leche Nido'],
    locked: ['Crema de chocolate'],
  },
  "m&m": {
    removable: ['Sin mozzarella', "Sin chocolate rallado", "Sin M&M's"],
    locked: ['Crema de chocolate'],
  },
  'banana': {
    removable: ['Sin mozzarella', 'Sin banana', 'Sin canela'],
    locked: [],
  },
};

/** Devuelve los ingredientes de pizza dulce { removable, locked } para un nombre dado */
export function getSweetPizzaIngredients(pizzaName) {
  if (!pizzaName) return null;
  const norm = normalize(pizzaName);
  for (const [key, values] of Object.entries(SWEET_PIZZA_INGREDIENTS)) {
    if (norm.includes(normalize(key)) || normalize(key).includes(norm)) {
      return values;
    }
  }
  // Fallback para cualquier pizza dulce no mapeada: solo mozzarella opcional
  return { removable: ['Sin mozzarella'], locked: [] };
}

/** Normaliza un string para matching insensible a tildes/mayúsculas */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Devuelve la lista de ingredientes removibles para un nombre de pizza dado. */
export function getRemovableIngredients(pizzaName) {
  if (!pizzaName) return [];
  const norm = normalize(pizzaName);
  for (const [key, values] of Object.entries(PIZZA_REMOVABLE_INGREDIENTS)) {
    if (norm.includes(normalize(key)) || normalize(key).includes(norm)) {
      return values;
    }
  }
  return [];
}