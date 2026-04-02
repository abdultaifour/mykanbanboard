import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Ticket } from '../types';

interface Props {
  ticket: Ticket;
  onDelete: (id: string) => void;
}

export function TicketCard({ ticket, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0" {...attributes} {...listeners}>
          <p className="font-medium text-sm text-gray-900 truncate" title={ticket.subject}>
            {ticket.subject}
          </p>
          <p className="text-xs text-blue-600 truncate mt-0.5" title={ticket.fromEmail}>
            {ticket.from}
          </p>
          {ticket.preview && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ticket.preview}</p>
          )}
          <p className="text-xs text-gray-400 mt-1.5">{ticket.date}</p>
        </div>
        <button
          onClick={() => onDelete(ticket.id)}
          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
          title="Ticket löschen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
