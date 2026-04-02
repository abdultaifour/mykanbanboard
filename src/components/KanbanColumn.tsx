import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column, Ticket } from '../types';
import { TicketCard } from './TicketCard';
import { useState, useRef } from 'react';
import { parseEml } from '../emlParser';

interface Props {
  column: Column;
  tickets: Ticket[];
  onTicketsAdded: (tickets: Omit<Ticket, 'id' | 'columnId' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
}

export function KanbanColumn({ column, tickets, onTicketsAdded, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileDrop(files: FileList) {
    const results: Omit<Ticket, 'id' | 'columnId' | 'createdAt'>[] = [];
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.eml') || file.type === 'message/rfc822') {
        const text = await file.text();
        const parsed = parseEml(text);
        results.push({
          subject: parsed.subject,
          from: parsed.from,
          fromEmail: parsed.fromEmail,
          date: parsed.date,
          preview: parsed.body,
        });
      }
    }
    if (results.length > 0) onTicketsAdded(results);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    // Check if it's a file being dragged (could be .eml)
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      await handleFileDrop(e.dataTransfer.files);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileDrop(e.target.files);
      e.target.value = '';
    }
  }

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-gray-200 min-w-[220px] flex-1"
      style={{ minHeight: 'calc(100vh - 120px)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className={`px-3 py-2.5 ${column.headerColor}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-white tracking-wide uppercase">{column.title}</h2>
          <span className="bg-white/20 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center">
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Drop Zone Hint */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 flex flex-col gap-2 transition-colors ${column.color} ${
          isDragOver || isOver ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''
        }`}
      >
        {tickets.length === 0 && !isDragOver && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs text-center px-3 py-8 border-2 border-dashed border-gray-300 rounded-lg m-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span>Outlook-Email<br />hier ablegen</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-blue-500 hover:text-blue-700 underline"
            >
              oder .eml wählen
            </button>
          </div>
        )}

        {isDragOver && (
          <div className="flex-1 flex items-center justify-center text-blue-500 text-sm font-medium py-8 border-2 border-dashed border-blue-400 rounded-lg m-1 bg-blue-50">
            Email hier ablegen
          </div>
        )}

        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onDelete={onDelete} />
          ))}
        </SortableContext>

        {tickets.length > 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-auto text-xs text-gray-400 hover:text-blue-500 py-2 text-center border border-dashed border-gray-300 hover:border-blue-400 rounded-lg transition-colors"
          >
            + Email hinzufügen
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".eml,message/rfc822"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );
}
