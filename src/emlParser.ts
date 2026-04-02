export interface ParsedEmail {
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  body: string;
  messageId: string;
}

function decodeRfc2047(str: string): string {
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, encoded) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const bytes = atob(encoded);
        return new TextDecoder(charset).decode(
          new Uint8Array([...bytes].map((c) => c.charCodeAt(0)))
        );
      } else {
        const decoded = encoded.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return decoded;
      }
    } catch {
      return encoded;
    }
  });
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"<]+)"?\s*<([^>]+)>/) ||
    from.match(/^([^<]*)<([^>]+)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  const emailOnly = from.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
  if (emailOnly) {
    return { name: emailOnly[1], email: emailOnly[1] };
  }
  return { name: from, email: '' };
}

function decodeBase64(encoded: string): string {
  try {
    const clean = encoded.replace(/\s/g, '');
    const bytes = atob(clean);
    return new TextDecoder('utf-8').decode(
      new Uint8Array([...bytes].map((c) => c.charCodeAt(0)))
    );
  } catch {
    return encoded;
  }
}

function decodeQuotedPrintable(encoded: string): string {
  return encoded
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTextBody(emlContent: string): string {
  const lines = emlContent.split(/\r?\n/);

  // Find boundary
  let boundary = '';
  for (const line of lines) {
    const m = line.match(/boundary="?([^";\s]+)"?/i);
    if (m) { boundary = m[1]; break; }
  }

  if (!boundary) {
    // No MIME multipart — find the body after the header block
    const headerEnd = emlContent.search(/\r?\n\r?\n/);
    if (headerEnd === -1) return '';
    const body = emlContent.slice(headerEnd).trim();
    // Check for base64/qp encoding in main headers
    const mainEnc = emlContent.slice(0, headerEnd).match(/Content-Transfer-Encoding:\s*(\S+)/i);
    if (mainEnc) {
      if (mainEnc[1].toLowerCase() === 'base64') return decodeBase64(body);
      if (mainEnc[1].toLowerCase() === 'quoted-printable') return decodeQuotedPrintable(body);
    }
    return body;
  }

  // Multipart: find text/plain part
  const parts = emlContent.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
  for (const part of parts) {
    if (/content-type:\s*text\/plain/i.test(part)) {
      const bodyStart = part.search(/\r?\n\r?\n/);
      if (bodyStart === -1) continue;
      const partBody = part.slice(bodyStart).trim();
      const encMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      if (encMatch) {
        if (encMatch[1].toLowerCase() === 'base64') return decodeBase64(partBody);
        if (encMatch[1].toLowerCase() === 'quoted-printable') return decodeQuotedPrintable(partBody);
      }
      return partBody;
    }
  }

  return '';
}

export function parseEml(content: string): ParsedEmail {
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === '') break;
    const match = line.match(/^([A-Za-z\-]+):\s*(.*)/);
    if (match) {
      let key = match[1].toLowerCase();
      let value = match[2];
      // Handle folded headers
      while (i + 1 < lines.length && /^[\t ]/.test(lines[i + 1])) {
        i++;
        value += ' ' + lines[i].trim();
      }
      headers[key] = value;
    }
    i++;
  }

  const subject = decodeRfc2047(headers['subject'] || '(kein Betreff)');
  const fromRaw = decodeRfc2047(headers['from'] || '');
  const { name, email } = parseFromHeader(fromRaw);
  const dateRaw = headers['date'] || '';
  const messageId = headers['message-id'] || `${Date.now()}-${Math.random()}`;

  let formattedDate = '';
  try {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } else {
      formattedDate = dateRaw;
    }
  } catch {
    formattedDate = dateRaw;
  }

  const body = extractTextBody(content);
  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 200);

  return { subject, from: name || email, fromEmail: email, date: formattedDate, body: preview, messageId };
}
