const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isValidStaffPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

export interface SendNotificationInput {
  alert_type: string;
  recipient: {
    email?: string;
    phone?: string;
    name: string;
  };
  template: {
    subject?: string;
    body: string;
  };
  channel: 'email' | 'sms';
  shop_id: string;
}

export function validateSendNotificationInput(body: unknown): { success: true; data: SendNotificationInput } | { success: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Invalid input: body must be an object' };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.alert_type !== 'string' || b.alert_type.length === 0) {
    return { success: false, error: 'alert_type must be a non-empty string' };
  }

  if (!b.recipient || typeof b.recipient !== 'object') {
    return { success: false, error: 'recipient must be an object' };
  }

  const recipient = b.recipient as Record<string, unknown>;
  if (recipient.email !== undefined && (typeof recipient.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email))) {
    return { success: false, error: 'recipient.email must be a valid email' };
  }
  if (recipient.phone !== undefined && typeof recipient.phone !== 'string') {
    return { success: false, error: 'recipient.phone must be a string' };
  }
  if (typeof recipient.name !== 'string' || recipient.name.length === 0) {
    return { success: false, error: 'recipient.name must be a non-empty string' };
  }

  if (!b.template || typeof b.template !== 'object') {
    return { success: false, error: 'template must be an object' };
  }

  const template = b.template as Record<string, unknown>;
  if (template.subject !== undefined && typeof template.subject !== 'string') {
    return { success: false, error: 'template.subject must be a string' };
  }
  if (typeof template.body !== 'string' || template.body.length === 0) {
    return { success: false, error: 'template.body must be a non-empty string' };
  }

  if (b.channel !== 'email' && b.channel !== 'sms') {
    return { success: false, error: 'channel must be either "email" or "sms"' };
  }

  if (typeof b.shop_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.shop_id)) {
    return { success: false, error: 'shop_id must be a valid UUID' };
  }

  return {
    success: true,
    data: {
      alert_type: b.alert_type,
      recipient: {
        email: recipient.email as string | undefined,
        phone: recipient.phone as string | undefined,
        name: recipient.name,
      },
      template: {
        subject: template.subject as string | undefined,
        body: template.body,
      },
      channel: b.channel,
      shop_id: b.shop_id,
    },
  };
}