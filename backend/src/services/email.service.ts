import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { readFile, writeFile } from 'node:fs/promises';
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export async function sendEmail(to: string, subject: string, message: string, action?: {
    label: string;
    url: string;
}): Promise<boolean> {
    if (process.env.EMAIL_MODE !== 'smtp') {
        if (!config.production && process.env.NODE_ENV !== 'test') {
            let messages: unknown[] = [];
            try {
                messages = JSON.parse(await readFile('.local-mail.json', 'utf8'));
            }
            catch { /* First development message. */ }
            messages.push({ to, subject, message, action, createdAt: new Date().toISOString() });
            await writeFile('.local-mail.json', JSON.stringify(messages.slice(-100), null, 2), { mode: 0o600 });
        }
        return false;
    }
    try {
        const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text: `${message}${action ? `\n${action.url}` : ''}`, html: `<div style="font-family:Arial;max-width:560px;padding:32px"><h2 style="color:#005ca8">RentEase</h2><h3>${escapeHtml(subject)}</h3><p>${escapeHtml(message)}</p>${action ? `<a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a>` : ''}<p>Your rental journey, made easier.</p></div>` });
        return true;
    }
    catch {
        console.error('Email delivery failed; notification remains available in the app.');
        return false;
    }
}
export const appLink = (path: string) => `${config.frontendUrl}${path}`;
