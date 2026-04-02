export type ColumnId = 'open' | 'in_progress' | 'blocked' | 'test' | 'done';

export interface Ticket {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  preview: string;
  columnId: ColumnId;
  createdAt: number;
}

export interface Column {
  id: ColumnId;
  title: string;
  color: string;
  headerColor: string;
}
