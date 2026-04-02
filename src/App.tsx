import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Column, ColumnId, Ticket } from './types';
import { KanbanColumn } from './components/KanbanColumn';
import { TicketCard } from './components/TicketCard';
import './index.css';

const COLUMNS: Column[] = [
  { id: 'open', title: 'Open', color: 'bg-gray-50', headerColor: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50', headerColor: 'bg-blue-500' },
  { id: 'blocked', title: 'Blocked', color: 'bg-red-50', headerColor: 'bg-red-500' },
  { id: 'test', title: 'Test', color: 'bg-yellow-50', headerColor: 'bg-yellow-500' },
  { id: 'done', title: 'Done', color: 'bg-green-50', headerColor: 'bg-green-600' },
];

function generateId() {
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadTickets(): Ticket[] {
  try {
    const stored = localStorage.getItem('kanban-tickets');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets: Ticket[]) {
  localStorage.setItem('kanban-tickets', JSON.stringify(tickets));
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>(loadTickets);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const updateAndSave = useCallback((updater: (prev: Ticket[]) => Ticket[]) => {
    setTickets((prev) => {
      const next = updater(prev);
      saveTickets(next);
      return next;
    });
  }, []);

  function handleTicketsAdded(
    columnId: ColumnId,
    newTickets: Omit<Ticket, 'id' | 'columnId' | 'createdAt'>[]
  ) {
    updateAndSave((prev) => [
      ...prev,
      ...newTickets.map((t) => ({
        ...t,
        id: generateId(),
        columnId,
        createdAt: Date.now(),
      })),
    ]);
  }

  function handleDelete(id: string) {
    updateAndSave((prev) => prev.filter((t) => t.id !== id));
  }

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const draggedTicket = tickets.find((t) => t.id === activeId);
    if (!draggedTicket) return;

    const overColumn = COLUMNS.find((c) => c.id === overId);
    const overTicket = tickets.find((t) => t.id === overId);
    const targetColumnId: ColumnId = overColumn
      ? overColumn.id
      : overTicket
      ? overTicket.columnId
      : draggedTicket.columnId;

    if (draggedTicket.columnId !== targetColumnId) {
      updateAndSave((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, columnId: targetColumnId } : t))
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    updateAndSave((prev) => {
      const activeIndex = prev.findIndex((t) => t.id === activeId);
      const overIndex = prev.findIndex((t) => t.id === overId);
      if (activeIndex === -1 || overIndex === -1) return prev;
      return arrayMove(prev, activeIndex, overIndex);
    });
  }

  function handleClearAll() {
    if (window.confirm('Alle Tickets löschen?')) {
      updateAndSave(() => []);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <h1 className="text-xl font-bold text-gray-800">Kanban Board</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{tickets.length} Ticket{tickets.length !== 1 ? 's' : ''}</span>
          {tickets.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              Alle löschen
            </button>
          )}
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 text-xs text-blue-700 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Outlook-Email auf eine Spalte ziehen (.eml-Datei) oder per Button hochladen — pro Email wird ein Ticket angelegt.
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 p-4 overflow-x-auto" style={{ minHeight: 'calc(100vh - 90px)' }}>
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tickets={tickets.filter((t) => t.columnId === column.id)}
              onTicketsAdded={(newTickets) => handleTicketsAdded(column.id, newTickets)}
              onDelete={handleDelete}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTicket && (
            <div className="rotate-2 shadow-xl">
              <TicketCard ticket={activeTicket} onDelete={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
