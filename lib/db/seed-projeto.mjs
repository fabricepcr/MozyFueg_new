/**
 * Seeds the projeto_tasks and projeto_checklist tables.
 * Safe to re-run — uses ON CONFLICT DO NOTHING on task code.
 */
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TASKS = [
  {
    code: "A1", epic_letter: "A", epic_name: "Marca e cores",
    title: "Rebranding verde, remover vermelho",
    scope: "Tema do cliente em tons de verde; remover o vermelho de botões e destaques.",
    needs_info: false, sort_order: 1,
    checklist: [
      "Nenhum botão/destaque vermelho nas páginas do cliente",
      "Paleta verde legível no celular",
      "Painel admin não afetado",
    ],
  },
  {
    code: "B1", epic_letter: "B", epic_name: "Montagem da pizza",
    title: "Escolha de múltiplos sabores",
    scope: "Até 2 sabores na pizza de 24 cm, até 4 na de 33 cm.",
    needs_info: false, sort_order: 2,
    checklist: [
      "24 cm limita a 2 sabores",
      "33 cm limita a 4 sabores",
      "Continua funcionando com 1 sabor",
    ],
  },
  {
    code: "B2", epic_letter: "B", epic_name: "Montagem da pizza",
    title: "Extras e remoções por sabor",
    scope: "Adicionar extras / remover ingredientes em cada sabor escolhido.",
    needs_info: false, sort_order: 3,
    checklist: [
      "Controles de extras/remoções por sabor",
      "Registrado por sabor no carrinho",
      "Enviado corretamente ao pedido",
    ],
  },
  {
    code: "B3", epic_letter: "B", epic_name: "Montagem da pizza",
    title: "Seletor de extras (máx. 3 + preços)",
    scope: "Limitar a 3 ingredientes extras; aplicar a tabela de preços de 24 cm.",
    needs_info: true, sort_order: 4,
    checklist: [
      "Não permite mais de 3 extras",
      "Cada extra soma seu preço ao total",
      "Preços de extras editáveis no admin",
    ],
  },
  {
    code: "B4", epic_letter: "B", epic_name: "Montagem da pizza",
    title: "Sabor mais caro no preço",
    scope: "Preço base = o sabor mais caro escolhido, mais os extras.",
    needs_info: false, sort_order: 5,
    checklist: [
      "Base = maior preço entre sabores escolhidos",
      "Extras somados por cima do base",
      "Verificado em 24 cm e 33 cm",
    ],
  },
  {
    code: "B5", epic_letter: "B", epic_name: "Montagem da pizza",
    title: "Aviso: sem doce + salgado",
    scope: "Mensagem no topo do pedido: não fazemos sabores doces e salgados na mesma pizza (texto em espanhol no site).",
    needs_info: false, sort_order: 6,
    checklist: [
      "Aviso visível na página de pedido no celular",
      "Aviso visível na página de pedido no desktop",
    ],
  },
  {
    code: "C1", epic_letter: "C", epic_name: "Carrinho e checkout",
    title: "Voltar no carrinho",
    scope: "Voltar ao cardápio a partir do carrinho sem perder os itens.",
    needs_info: false, sort_order: 7,
    checklist: [
      "Sair do carrinho mantém os itens",
      "Ao voltar, mesmo carrinho e totais",
    ],
  },
  {
    code: "C2", epic_letter: "C", epic_name: "Carrinho e checkout",
    title: "Horário de retirada",
    scope: "Pedidos para retirar: cliente informa o horário de chegada.",
    needs_info: false, sort_order: 8,
    checklist: [
      "Campo de horário aparece só para retirada",
      "Horário salvo e mostrado no admin",
    ],
  },
  {
    code: "C3", epic_letter: "C", epic_name: "Carrinho e checkout",
    title: "Agendar pedido + aviso",
    scope: "Agendar para mais tarde, avisando que o horário é aproximado.",
    needs_info: false, sort_order: 9,
    checklist: [
      "Cliente escolhe horário de agendamento",
      "Aviso de horário aproximado exibido",
      "Agendamento salvo e visível no admin",
    ],
  },
  {
    code: "C4", epic_letter: "C", epic_name: "Carrinho e checkout",
    title: "Mensagem de pagamento",
    scope: "Cartão no local; dinheiro só com valor exato, sem troco.",
    needs_info: true, sort_order: 10,
    checklist: [
      "Mensagem de pagamento exibida no checkout",
      "Texto aprovado pelo cliente",
    ],
  },
  {
    code: "D1", epic_letter: "D", epic_name: "Acompanhamento",
    title: "Status persistente + histórico + repetir",
    scope: "Ver o pedido atual ao voltar ao site; histórico; repetir pedido.",
    needs_info: false, sort_order: 11,
    checklist: [
      "Reabrir a aba mostra pedido e status atual",
      "Status atualiza automaticamente",
      "Histórico de pedidos acessível",
      "Repetir pedido adiciona itens ao carrinho",
    ],
  },
  {
    code: "E1", epic_letter: "E", epic_name: "Admin: pedidos",
    title: "Corrigir alarme de novo pedido",
    scope: "O alarme sonoro dispara de forma confiável em novo pedido.",
    needs_info: false, sort_order: 12,
    checklist: [
      "Novo pedido toca som a tempo",
      "Funciona com a aba em segundo plano",
      "Para corretamente após reconhecimento",
    ],
  },
  {
    code: "E2", epic_letter: "E", epic_name: "Admin: pedidos",
    title: "Enviar ao entregador + impressora",
    scope: "Enviar o pedido ao celular do entregador (WhatsApp) e à impressora.",
    needs_info: true, sort_order: 13,
    checklist: [
      "Uma ação envia ao entregador via WhatsApp",
      "Uma ação envia à impressora",
      "Confirmado em aparelhos reais",
    ],
  },
  {
    code: "E3", epic_letter: "E", epic_name: "Admin: pedidos",
    title: "Link do entregador: nome/endereço + Maps",
    scope: "O link do entregador mostra nome e endereço e abre a rota no Google Maps.",
    needs_info: false, sort_order: 14,
    checklist: [
      "Link mostra nome e endereço completo",
      "Abrir link inicia o app do Maps com a rota",
    ],
  },
  {
    code: "F1", epic_letter: "F", epic_name: "Disponibilidade",
    title: "Desativar por tamanho de pizza",
    scope: "Ativar/desativar 24 e 33 cm de forma independente.",
    needs_info: false, sort_order: 15,
    checklist: [
      "Desativar 33 cm bloqueia só o tamanho 33",
      "Desativar 24 cm bloqueia só o tamanho 24",
      "Delivery segue ativo com um tamanho desativado",
    ],
  },
  {
    code: "G1", epic_letter: "G", epic_name: "Tela do garçom",
    title: "Tela de pedidos do garçom + impressão",
    scope: "Tela para o garçom lançar pedidos (comer no local / take away) e imprimir a comanda.",
    needs_info: false, sort_order: 16,
    checklist: [
      "Tela acessível à equipe (sem login obrigatório)",
      "Cardápio completo com sabores e extras",
      "Ver/editar pedido antes de finalizar",
      "Imprime a comanda corretamente",
    ],
  },
];

async function main() {
  console.log("Seeding projeto tasks...");
  let inserted = 0;
  let skipped = 0;

  for (const task of TASKS) {
    const { rows } = await pool.query(
      `INSERT INTO "projeto_tasks"
         (code, epic_letter, epic_name, title, scope, needs_info, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
      [task.code, task.epic_letter, task.epic_name, task.title, task.scope, task.needs_info, task.sort_order],
    );

    if (rows.length === 0) { skipped++; continue; }
    inserted++;
    const taskId = rows[0].id;

    for (let i = 0; i < task.checklist.length; i++) {
      await pool.query(
        `INSERT INTO "projeto_checklist" (task_id, text, sort_order)
         VALUES ($1,$2,$3)`,
        [taskId, task.checklist[i], i],
      );
    }
  }

  const { rows: counts } = await pool.query(
    `SELECT COUNT(*) as tasks FROM "projeto_tasks"`,
  );
  const { rows: clCounts } = await pool.query(
    `SELECT COUNT(*) as items FROM "projeto_checklist"`,
  );
  console.log(`Done. Inserted ${inserted} tasks (${skipped} skipped). DB: ${counts[0].tasks} tasks, ${clCounts[0].items} checklist items.`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
