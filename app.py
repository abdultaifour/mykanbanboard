import json
import email
import email.header
import uuid
import os
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

DATA_FILE = 'tickets.json'

COLUMNS = ['open', 'in_progress', 'blocked', 'test', 'done']


def load_tickets():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_tickets(tickets):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(tickets, f, ensure_ascii=False, indent=2)


def decode_header_value(value):
    if not value:
        return ''
    parts = email.header.decode_header(value)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            try:
                result.append(part.decode(charset or 'utf-8', errors='replace'))
            except (LookupError, UnicodeDecodeError):
                result.append(part.decode('utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)


def parse_eml(file_bytes):
    msg = email.message_from_bytes(file_bytes)

    subject = decode_header_value(msg.get('Subject', '(kein Betreff)'))
    from_raw = decode_header_value(msg.get('From', ''))
    date_raw = msg.get('Date', '')
    message_id = msg.get('Message-ID', str(uuid.uuid4()))

    # Parse sender name and email
    from_name = from_raw
    from_email = ''
    if '<' in from_raw and '>' in from_raw:
        from_email = from_raw[from_raw.index('<') + 1:from_raw.index('>')]
        from_name = from_raw[:from_raw.index('<')].strip().strip('"')
    elif '@' in from_raw:
        from_email = from_raw.strip()
        from_name = from_raw.strip()

    # Format date
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(date_raw)
        date_formatted = dt.strftime('%d.%m.%Y %H:%M')
    except Exception:
        date_formatted = date_raw

    # Extract plain text body
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                charset = part.get_content_charset() or 'utf-8'
                try:
                    body = part.get_payload(decode=True).decode(charset, errors='replace')
                except Exception:
                    body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                break
    else:
        if msg.get_content_type() == 'text/plain':
            charset = msg.get_content_charset() or 'utf-8'
            try:
                body = msg.get_payload(decode=True).decode(charset, errors='replace')
            except Exception:
                body = ''

    preview = ' '.join(body.split())[:300]

    return {
        'subject': subject,
        'from_name': from_name or from_email,
        'from_email': from_email,
        'date': date_formatted,
        'preview': preview,
        'message_id': message_id.strip('<>'),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    return jsonify(load_tickets())


@app.route('/api/tickets', methods=['POST'])
def create_ticket():
    column = request.form.get('column', 'open')
    if column not in COLUMNS:
        return jsonify({'error': 'Ungültige Spalte'}), 400

    if 'eml' not in request.files:
        return jsonify({'error': 'Keine EML-Datei'}), 400

    file = request.files['eml']
    parsed = parse_eml(file.read())

    ticket = {
        'id': str(uuid.uuid4()),
        'column': column,
        **parsed,
    }

    tickets = load_tickets()
    tickets.append(ticket)
    save_tickets(tickets)

    return jsonify(ticket), 201


@app.route('/api/tickets/<ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    data = request.get_json()
    tickets = load_tickets()

    for ticket in tickets:
        if ticket['id'] == ticket_id:
            if 'column' in data and data['column'] in COLUMNS:
                ticket['column'] = data['column']
            save_tickets(tickets)
            return jsonify(ticket)

    return jsonify({'error': 'Ticket nicht gefunden'}), 404


@app.route('/api/tickets/<ticket_id>', methods=['DELETE'])
def delete_ticket(ticket_id):
    tickets = load_tickets()
    tickets = [t for t in tickets if t['id'] != ticket_id]
    save_tickets(tickets)
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
