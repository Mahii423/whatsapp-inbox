export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

const STATUS_RANK: Record<DeliveryStatus, number> = {
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function normalizeWhatsAppStatus(
  value: unknown
): DeliveryStatus | null {
  if (
    value === "sent" ||
    value === "delivered" ||
    value === "read" ||
    value === "failed"
  ) {
    return value;
  }

  return null;
}

export function nextDeliveryStatus(
  current: string | null | undefined,
  incoming: DeliveryStatus
): DeliveryStatus {
  if (incoming === "failed") {
    return "failed";
  }

  if (current === "failed") {
    return "failed";
  }

  const currentRank =
    current && current in STATUS_RANK
      ? STATUS_RANK[current as DeliveryStatus]
      : 0;

  return STATUS_RANK[incoming] >= currentRank
    ? incoming
    : (current as DeliveryStatus);
}

export function failedStatusError(statusItem: {
  errors?: Array<{ title?: string; message?: string; code?: number }>;
}): string | null {
  const first = statusItem.errors?.[0];

  if (!first) {
    return "Message failed to send";
  }

  return first.title || first.message || `WhatsApp error ${first.code ?? ""}`.trim();
}
