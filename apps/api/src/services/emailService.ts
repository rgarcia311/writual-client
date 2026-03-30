import { Resend } from 'resend';
import emailConfig from '../config/emailConfig.json';

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailConfig = {
  subject: string;
  from: string;
  fromName: string;
  templateName: string;
};

function resolveConfig(eventKey: string): EmailConfig {
  const parts = eventKey.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = emailConfig;
  for (const part of parts) {
    current = current?.[part];
  }
  if (!current || !current.subject || !current.from || !current.templateName) {
    throw new Error(`Email config not found for event key: ${eventKey}`);
  }
  return current as EmailConfig;
}

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

// Inline HTML templates keyed by templateName
const templates: Record<string, (vars: Record<string, string>) => string> = {
  'project-share-invite-existing': (v) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #2D8060;">You've been invited to collaborate</h2>
      <p>Hi there,</p>
      <p><strong>${v.inviterName}</strong> has invited you to collaborate on the project <strong>"${v.projectTitle}"</strong> on Writual.</p>
      <p><strong>Access granted:</strong> ${v.aspects}</p>
      <p><strong>Permission level:</strong> ${v.permissionLevel === 'edit' ? 'Edit / Collaborate' : 'Comment Only'}</p>
      <div style="margin: 32px 0;">
        <a href="${process.env.APP_URL ?? 'https://app.writual.io'}/project/${v.projectId}"
           style="background: #2D8060; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Open Project
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">The Writual Team</p>
    </div>
  `,
  'project-share-invite-new': (v) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #2D8060;">You're invited to Writual</h2>
      <p>Hi there,</p>
      <p><strong>${v.inviterName}</strong> has invited you to collaborate on <strong>"${v.projectTitle}"</strong> on Writual — the story development platform for screenwriters.</p>
      <p><strong>Access granted:</strong> ${v.aspects}</p>
      <p><strong>Permission level:</strong> ${v.permissionLevel === 'edit' ? 'Edit / Collaborate' : 'Comment Only'}</p>
      <p>Create your free account and the project will be waiting for you:</p>
      <div style="margin: 32px 0;">
        <a href="${process.env.APP_URL ?? 'https://app.writual.io'}/invite?token=${v.inviteToken}"
           style="background: #2D8060; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">This invitation link is unique to you. The Writual Team</p>
    </div>
  `,
  'project-share-accepted': (v) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #2D8060;">A collaborator joined your project</h2>
      <p><strong>${v.collaboratorName}</strong> has accepted your invitation and joined <strong>"${v.projectTitle}"</strong>.</p>
      <div style="margin: 32px 0;">
        <a href="${process.env.APP_URL ?? 'https://app.writual.io'}/project/${v.projectId}"
           style="background: #2D8060; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Open Project
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">The Writual Team</p>
    </div>
  `,
};

function buildHtml(templateName: string, variables: Record<string, string>): string {
  const fn = templates[templateName];
  if (fn) return fn(variables);
  // Fallback for templates without inline implementations
  return `<p>You have a new notification from Writual.</p>`;
}

export async function sendEmail(
  eventKey: string,
  to: string,
  variables: Record<string, string>
): Promise<void> {
  const config = resolveConfig(eventKey);
  const subject = interpolate(config.subject, variables);
  const html = buildHtml(config.templateName, variables);
  const from = `${config.fromName} <${config.from}>`;

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
