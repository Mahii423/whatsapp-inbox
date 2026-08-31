export type WhatsAppStatus = 'sent' | 'delivered' | 'read' | 'failed';

export function normalizeWhatsAppStatus(status: string): WhatsAppStatus {
  const s = status.toLowerCase();
  if (s === 'read') return 'read';
  if (s === 'delivered') return 'delivered';
  if (s === 'failed') return 'failed';
  return 'sent';
}

export function nextDeliveryStatus(current: WhatsAppStatus, next: WhatsAppStatus): WhatsAppStatus {
  const order = { sent: 1, delivered: 2, read: 3, failed: 0 };
  if (order[next] > order[current] || next === 'failed') return next;
  return current;
}

export function failedStatusError(status: string, error?: any) {
  return {
    status: 'failed',
    error: error || status,
    timestamp: new Date().toISOString()
  };
}