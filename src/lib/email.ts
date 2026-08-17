/**
 * Outbound email.
 *
 * Provider choice is still open (docs/BACKEND_PLAN.md P4), so this is a thin
 * seam rather than a commitment: one `send()` with two drivers behind it.
 * Resend is wired because it needs nothing but an API key and a fetch call —
 * swapping it for Postmark or SES means replacing one function, not hunting
 * call sites.
 *
 * With no key configured the log driver runs, which is what makes this safe to
 * merge before the provider decision lands: development and CI get a visible
 * record of what would have been sent, and nothing silently disappears.
 *
 * Sends are best-effort by design. Volume here is admin-action-driven, not
 * user-driven, so a queue is not yet worth its operational weight — but an
 * override must never fail because a mail API had a bad minute, so callers
 * get a boolean and the audit row is written regardless.
 */

export type Email = {
  to: string;
  subject: string;
  text: string;
};

const FROM = process.env.EMAIL_FROM ?? 'the index <no-reply@example.com>';

async function sendViaResend(msg: Email, apiKey: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
  });

  if (!res.ok) {
    throw new Error(`Resend rejected the message: ${res.status} ${await res.text()}`);
  }
}

function sendViaLog(msg: Email) {
  // eslint-disable-next-line no-console
  console.info(
    `[email:log-driver] no provider configured — would send to ${msg.to}\n` +
      `  subject: ${msg.subject}\n` +
      msg.text.replace(/^/gm, '  | '),
  );
}

export async function sendEmail(msg: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  try {
    if (apiKey) await sendViaResend(msg, apiKey);
    else sendViaLog(msg);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err);
    return false;
  }
}

const appUrl = () => process.env.AUTH_URL ?? 'http://localhost:3000';

/**
 * The override notice. This is the email that matters most in the product: an
 * admin has just edited a live storefront URL, and the merchant learning about
 * it from us rather than from a customer is the entire difference between
 * support and a chargeback (docs/ARCHITECTURE.md §7).
 */
export function overrideNoticeEmail(input: {
  to: string;
  storeName: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}): Email {
  return {
    to: input.to,
    subject: `Your store card was edited by support — ${input.storeName}`,
    text: [
      `A member of the support team changed your ${input.field}.`,
      '',
      `  before: ${input.before}`,
      `  after:  ${input.after}`,
      `  reason: ${input.reason}`,
      '',
      'If this is wrong, you can revert it yourself in one click:',
      `${appUrl()}/merchant`,
      '',
      'This change is recorded in a permanent audit log.',
    ].join('\n'),
  };
}

export function verificationDecisionEmail(input: {
  to: string;
  storeName: string;
  granted: boolean;
  note?: string;
}): Email {
  return {
    to: input.to,
    subject: input.granted
      ? `${input.storeName} is now a Verified Maker`
      : `Verified Maker review — ${input.storeName}`,
    text: input.granted
      ? [
          `${input.storeName} has been granted the Verified Maker badge.`,
          '',
          'It now appears on your store card and next to your name in the community.',
          input.note ? `\nNote from the reviewer: ${input.note}` : '',
          `\n${appUrl()}/merchant`,
        ].join('\n')
      : [
          `We reviewed ${input.storeName} for the Verified Maker badge and did not grant it this time.`,
          '',
          input.note ? `Reviewer note: ${input.note}` : 'No further detail was recorded.',
          '',
          'Your listing is unaffected and stays published. You are welcome to reapply.',
        ].join('\n'),
  };
}

export function passwordResetEmail(input: { to: string; token: string }): Email {
  return {
    to: input.to,
    subject: 'Reset your password',
    text: [
      'Someone asked to reset the password on this account.',
      '',
      `${appUrl()}/merchant/reset?token=${encodeURIComponent(input.token)}`,
      '',
      'The link is valid for one hour and can be used once.',
      'If this was not you, ignore this email — nothing has changed.',
    ].join('\n'),
  };
}
