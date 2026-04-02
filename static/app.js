'use strict';

const COLUMNS = [
  { id: 'open',        title: 'Open' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'blocked',     title: 'Blocked' },
  { id: 'test',        title: 'Test' },
  { id: 'done',        title: 'Done' },
];

let tickets = [];
let dragId   = null;   // ID of ticket being dragged (between columns)
let dragOver = null;   // column or ticket element currently hovered

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiGet(url) {
  const r = await fetch(url);
  return r.json();
}

async function apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', body });
  return r.json();
}

async function apiPut(url, data) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

async function apiDelete(url) {
  return fetch(url, { method: 'DELETE' });
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  COLUMNS.forEach(col => {
    const colTickets = tickets.filter(t => t.column === col.id);

    const colEl = document.createElement('div');
    colEl.className = `column col-${col.id}`;
    colEl.dataset.col = col.id;

    // Header
    colEl.innerHTML = `
      <div class="column-header">
        <h2>${col.title}</h2>
        <span class="column-badge">${colTickets.length}</span>
      </div>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'column-body';
    body.dataset.col = col.id;

    if (colTickets.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
        <span>Outlook-Email<br>hier ablegen</span>
        <button onclick="openFilePicker('${col.id}')">oder .eml wählen</button>
      `;
      body.appendChild(hint);
    } else {
      colTickets.forEach(ticket => {
        body.appendChild(makeTicketEl(ticket));
      });
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.textContent = '+ Email hinzufügen';
      addBtn.onclick = () => openFilePicker(col.id);
      body.appendChild(addBtn);
    }

    colEl.appendChild(body);

    // File-drop on entire column
    colEl.addEventListener('dragover', onColumnDragOver);
    colEl.addEventListener('dragleave', onColumnDragLeave);
    colEl.addEventListener('drop', onColumnDrop);

    board.appendChild(colEl);
  });

  document.getElementById('ticket-count').textContent =
    `${tickets.length} Ticket${tickets.length !== 1 ? 's' : ''}`;
}

function makeTicketEl(ticket) {
  const el = document.createElement('div');
  el.className = 'ticket';
  el.draggable = true;
  el.dataset.id = ticket.id;
  el.innerHTML = `
    <button class="ticket-delete" title="Löschen" onclick="deleteTicket('${ticket.id}')">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div class="ticket-subject" title="${esc(ticket.subject)}">${esc(ticket.subject)}</div>
    <div class="ticket-from">${esc(ticket.from_name || ticket.from_email)}</div>
    ${ticket.preview ? `<div class="ticket-preview">${esc(ticket.preview)}</div>` : ''}
    <div class="ticket-date">${esc(ticket.date)}</div>
  `;

  // Drag events for reordering / column move
  el.addEventListener('dragstart', e => {
    dragId = ticket.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticket.id);

    const ghost = document.getElementById('drag-ghost');
    ghost.textContent = ticket.subject;
    ghost.classList.remove('hidden');
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.getElementById('drag-ghost').classList.add('hidden');
    dragId = null;
    document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  });

  return el;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Drag ghost follows cursor ─────────────────────────────────────────────────

document.addEventListener('dragover', e => {
  const ghost = document.getElementById('drag-ghost');
  if (!ghost.classList.contains('hidden')) {
    ghost.style.left = (e.clientX + 14) + 'px';
    ghost.style.top  = (e.clientY - 10) + 'px';
  }
});

// ── Column drag-and-drop (for .eml files AND ticket moves) ────────────────────

function onColumnDragOver(e) {
  const types = Array.from(e.dataTransfer.types);
  if (types.includes('Files') || types.includes('text/plain')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.currentTarget;
    document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
    col.classList.add('drag-over');
  }
}

function onColumnDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function onColumnDrop(e) {
  e.currentTarget.classList.remove('drag-over');

  // .eml file drop
  if (e.dataTransfer.files.length > 0) {
    e.preventDefault();
    const colId = e.currentTarget.dataset.col;
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.eml') || f.name.endsWith('.msg') ||
           f.type === 'message/rfc822' || f.type === 'application/vnd.ms-outlook'
    );
    if (files.length === 0) {
      alert('Bitte eine Outlook-Email (.msg) oder .eml-Datei ablegen.');
      return;
    }
    for (const file of files) {
      await uploadEml(file, colId);
    }
    return;
  }

  // Ticket move between columns
  const id = e.dataTransfer.getData('text/plain');
  if (!id) return;
  e.preventDefault();
  const colId = e.currentTarget.dataset.col;
  await moveTicket(id, colId);
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function uploadEml(file, colId) {
  const fd = new FormData();
  fd.append('eml', file);
  fd.append('column', colId);
  try {
    const ticket = await apiPost('/api/tickets', fd);
    if (ticket.error) { alert('Fehler: ' + ticket.error); return; }
    tickets.push(ticket);
    render();
  } catch (err) {
    alert('Fehler beim Hochladen: ' + err);
  }
}

async function moveTicket(id, colId) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket || ticket.column === colId) return;
  ticket.column = colId;          // optimistic update
  render();
  await apiPut(`/api/tickets/${id}`, { column: colId });
}

async function deleteTicket(id) {
  tickets = tickets.filter(t => t.id !== id);
  render();
  await apiDelete(`/api/tickets/${id}`);
}

function openFilePicker(colId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.eml,.msg,message/rfc822,application/vnd.ms-outlook';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of Array.from(input.files)) {
      await uploadEml(file, colId);
    }
  };
  input.click();
}

function toggleHowto(e) {
  e.preventDefault();
  document.getElementById('howto').classList.toggle('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  tickets = await apiGet('/api/tickets');
  render();
})();
