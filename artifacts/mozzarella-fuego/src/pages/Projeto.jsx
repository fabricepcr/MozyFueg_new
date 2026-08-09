import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, RefreshCw, CheckSquare, Square } from 'lucide-react';

const COLUMNS = [
  { id: 'a_fazer',      label: 'A fazer',       color: 'border-slate-400',   header: 'bg-slate-100 dark:bg-slate-800',  badge: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' },
  { id: 'em_andamento', label: 'Em andamento',  color: 'border-blue-400',    header: 'bg-blue-50 dark:bg-blue-950',     badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' },
  { id: 'em_qa',        label: 'Em QA',         color: 'border-amber-400',   header: 'bg-amber-50 dark:bg-amber-950',   badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200' },
  { id: 'concluido',    label: 'Concluído',     color: 'border-green-500',   header: 'bg-green-50 dark:bg-green-950',   badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' },
];

const EPIC_COLORS = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  B: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  C: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  D: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  E: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  F: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  G: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

const PERGUNTAS = [
  { code: 'B3', text: 'Faltam os preços dos extras de 33 cm.' },
  { code: 'E2', text: 'Envio pelo WhatsApp por link wa.me ou API oficial do WhatsApp Business?' },
  { code: 'E2/G1', text: 'Qual impressora — o componente Thermer atual ou um modelo específico?' },
  { code: 'C4', text: 'Formas de pagamento aceitas: cartão na entrega + dinheiro exato sem troco, e se Bizum continua aceito.' },
];

function TaskCard({ task, onStatusChange, onToggleCheck }) {
  const [open, setOpen] = useState(false);
  const epicColor = EPIC_COLORS[task.epic_letter] || 'bg-gray-100 text-gray-800';
  const checklist = task.checklist || [];
  const checkedCount = checklist.filter(c => c.checked).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${epicColor}`}>
              {task.epic_letter} · {task.epic_name}
            </span>
            <span className="text-[11px] font-mono font-bold text-gray-500 dark:text-gray-400">{task.code}</span>
          </div>
          {task.needs_info && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded-md shrink-0">
              <AlertCircle className="w-2.5 h-2.5" />
              Falta info
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{task.title}</p>

        {/* Scope */}
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{task.scope}</p>

        {/* Status selector */}
        <select
          value={task.status}
          onChange={e => onStatusChange(task.id, e.target.value)}
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {COLUMNS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        {/* QA toggle */}
        {checklist.length > 0 && (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors pt-1"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>QA — {checkedCount}/{checklist.length}</span>
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }}
              />
            </div>
          </button>
        )}

        {/* QA checklist */}
        {open && checklist.length > 0 && (
          <div className="pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-700 mt-1">
            {checklist.map(item => (
              <button
                key={item.id}
                onClick={() => onToggleCheck(item.id, !item.checked)}
                className="flex items-start gap-2 w-full text-left text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
              >
                {item.checked
                  ? <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  : <Square className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                }
                <span className={item.checked ? 'line-through text-gray-400' : ''}>{item.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Column({ col, tasks, onStatusChange, onToggleCheck }) {
  return (
    <div className={`rounded-xl border-t-4 ${col.color} ${col.header} min-w-[260px] flex-1 flex flex-col`}>
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{col.label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{tasks.length}</span>
      </div>
      <div className="px-3 pb-3 space-y-2.5 flex-1 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Nenhuma tarefa</p>
        )}
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onStatusChange={onStatusChange}
            onToggleCheck={onToggleCheck}
          />
        ))}
      </div>
    </div>
  );
}

export default function Projeto() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCol, setActiveCol] = useState(null); // null = all (desktop), col id on mobile

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/projeto/tasks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTasks(json.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleStatusChange = async (taskId, newStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await fetch(`/api/projeto/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      loadTasks(); // rollback on failure
    }
  };

  const handleToggleCheck = async (checkId, checked) => {
    // Optimistic update
    setTasks(prev => prev.map(t => ({
      ...t,
      checklist: t.checklist.map(c => c.id === checkId ? { ...c, checked } : c),
    })));
    try {
      await fetch(`/api/projeto/checklist/${checkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked }),
      });
    } catch {
      loadTasks();
    }
  };

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'concluido').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const tasksByCol = Object.fromEntries(
    COLUMNS.map(c => [c.id, tasks.filter(t => t.status === c.id).sort((a, b) => a.sort_order - b.sort_order)])
  );

  // On mobile, show one column at a time; on desktop show all
  const visibleCols = activeCol ? COLUMNS.filter(c => c.id === activeCol) : COLUMNS;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      {/* Header */}
      <div className="bg-green-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold tracking-tight">🍕 Quadro de melhorias</h1>
              <p className="text-green-200 text-xs mt-0.5">Mozzarella y Fuego — Barcelona</p>
            </div>
            <button
              onClick={loadTasks}
              className="p-2 rounded-lg bg-green-700 hover:bg-green-600 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-green-200 mb-1">
              <span>{done} de {total} tarefas concluídas</span>
              <span className="font-bold text-white">{progress}%</span>
            </div>
            <div className="h-2 bg-green-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {COLUMNS.map(c => (
              <span key={c.id} className="text-xs bg-green-700 px-2 py-1 rounded-lg">
                <span className="text-green-200">{c.label}:</span>{' '}
                <span className="font-bold text-white">{tasksByCol[c.id]?.length ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile column tabs */}
      <div className="sm:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto">
        <button
          onClick={() => setActiveCol(null)}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${!activeCol ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
        >
          Todas
        </button>
        {COLUMNS.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCol(c.id)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeCol === c.id ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
          >
            {c.label} ({tasksByCol[c.id]?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Carregando tarefas...</span>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            Erro ao carregar tarefas: {error}
          </div>
        )}

        {/* Kanban board */}
        {!loading && !error && (
          <div className={`flex gap-3 ${activeCol ? '' : 'overflow-x-auto pb-2'}`}>
            {visibleCols.map(col => (
              <Column
                key={col.id}
                col={col}
                tasks={tasksByCol[col.id] || []}
                onStatusChange={handleStatusChange}
                onToggleCheck={handleToggleCheck}
              />
            ))}
          </div>
        )}

        {/* Perguntas a confirmar */}
        {!loading && !error && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4" />
              Perguntas a confirmar com o cliente
            </h2>
            <ul className="space-y-2">
              {PERGUNTAS.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0 text-xs mt-0.5">({p.code})</span>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
