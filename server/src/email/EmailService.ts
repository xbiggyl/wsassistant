import nodemailer from 'nodemailer';
import { createLogger } from '@shared';
import type { MeetingMinutes } from '@shared';

const log = createLogger('email');

export class EmailService {
  private transporter: any = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    log('Initializing email service...');

    try {
      // Configure SMTP transporter
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false // For local development
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.isInitialized = true;
      log('Email service initialized successfully');
    } catch (error) {
      log('Email service initialization failed:', error);
      // Don't throw error - email is optional functionality
      this.isInitialized = false;
    }
  }

  async sendMeetingMinutes(meetingMinutes: MeetingMinutes): Promise<void> {
    if (!this.isInitialized) {
      log('Email service not initialized, skipping email send');
      return;
    }

    try {
      const recipients = meetingMinutes.meetingInfo.participants
        .filter(p => p.email)
        .map(p => p.email);

      if (recipients.length === 0) {
        log('No email recipients found');
        return;
      }

      const emailContent = this.generateEmailContent(meetingMinutes);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'meetassist@localhost',
        to: recipients.join(', '),
        subject: `Meeting Minutes: ${meetingMinutes.meetingInfo.title}`,
        html: emailContent,
        attachments: [
          {
            filename: `meeting-minutes-${meetingMinutes.meetingInfo.id}.json`,
            content: JSON.stringify(meetingMinutes, null, 2),
            contentType: 'application/json'
          }
        ]
      };

      await this.transporter.sendMail(mailOptions);
      log(`Meeting minutes sent to ${recipients.length} recipients`);
    } catch (error) {
      log('Failed to send meeting minutes:', error);
    }
  }

  private generateEmailContent(meetingMinutes: MeetingMinutes): string {
    const { meetingInfo, summaries, transcript } = meetingMinutes;
    
    const summaryHtml = summaries.map(summary => `
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
        <h4 style="margin: 0 0 10px 0; color: #333;">
          Summary (${this.formatTime(summary.startTime)} - ${this.formatTime(summary.endTime)})
        </h4>
        <ul style="margin: 0; padding-left: 20px;">
          ${summary.bullets.map(bullet => `<li style="margin-bottom: 5px;">${bullet}</li>`).join('')}
        </ul>
        ${summary.keyPoints.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong>Key Topics:</strong> 
            ${summary.keyPoints.map(point => `<span style="background-color: #e3f2fd; padding: 2px 6px; border-radius: 3px; margin-right: 5px; font-size: 12px;">${point}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Meeting Minutes</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h1 style="margin: 0 0 10px 0; font-size: 28px;">📝 Meeting Minutes</h1>
          <h2 style="margin: 0; font-size: 20px; opacity: 0.9;">${meetingInfo.title}</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.8;">
            ${new Date(meetingInfo.startTime).toLocaleDateString()} • 
            ${new Date(meetingInfo.startTime).toLocaleTimeString()} • 
            ${meetingInfo.participants.length} participants
          </p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">👥 Participants</h3>
          <ul style="list-style: none; padding: 0;">
            ${meetingInfo.participants.map(p => `
              <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                <strong>${p.name}</strong>
                ${p.email ? `<span style="color: #666; margin-left: 10px;">${p.email}</span>` : ''}
                ${p.isSelf ? '<span style="background-color: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 10px;">YOU</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">📋 Meeting Summary</h3>
          ${summaryHtml}
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">💬 Full Transcript</h3>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
            ${transcript.slice(0, 50).map(chunk => `
              <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #dee2e6;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">
                  [${this.formatTime(chunk.startTime)}] <strong>${chunk.speakerName}</strong>
                </div>
                <div style="font-size: 14px;">${chunk.text}</div>
              </div>
            `).join('')}
            ${transcript.length > 50 ? '<p style="text-align: center; color: #6c757d; font-style: italic;">... and more (see attached file for complete transcript)</p>' : ''}
          </div>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Generated by <strong>MeetAssist</strong> - Privacy-first AI meeting assistant<br>
            <small>All processing done locally • No data sent to external servers</small>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async cleanup(): Promise<void> {
    log('Cleaning up email service...');
    if (this.transporter) {
      this.transporter.close();
    }
  }
}