import { promises as fs } from 'fs';
import path from 'path';
import { createLogger, createMeetingFolder, sanitizeFilename } from '@meetassist/shared';
import type { MeetingMinutes } from '@meetassist/shared';

const log = createLogger('storage');

export class StorageService {
  private baseDir: string;

  constructor(baseDir: string = './MeetAssist') {
    this.baseDir = baseDir;
  }

  async initialize(): Promise<void> {
    log('Initializing storage service...');
    
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      log(`Storage directory created: ${this.baseDir}`);
    } catch (error) {
      log('Failed to create storage directory:', error);
      throw error;
    }
  }

  async saveMeeting(meetingMinutes: MeetingMinutes): Promise<void> {
    const folderName = createMeetingFolder(
      meetingMinutes.meetingInfo.id,
      new Date(meetingMinutes.meetingInfo.startTime)
    );
    
    const meetingDir = path.join(this.baseDir, sanitizeFilename(folderName));
    
    try {
      // Create meeting directory
      await fs.mkdir(meetingDir, { recursive: true });
      
      // Save meeting minutes as JSON
      const minutesPath = path.join(meetingDir, 'meeting-minutes.json');
      await fs.writeFile(minutesPath, JSON.stringify(meetingMinutes, null, 2));
      
      // Save transcript as text file
      const transcriptPath = path.join(meetingDir, 'transcript.txt');
      const transcriptText = meetingMinutes.transcript
        .map(chunk => `[${this.formatTime(chunk.startTime)}] ${chunk.speakerName}: ${chunk.text}`)
        .join('\n');
      await fs.writeFile(transcriptPath, transcriptText);
      
      // Save summaries as markdown
      const summaryPath = path.join(meetingDir, 'summary.md');
      const summaryMarkdown = this.generateSummaryMarkdown(meetingMinutes);
      await fs.writeFile(summaryPath, summaryMarkdown);
      
      log(`Meeting saved to: ${meetingDir}`);
    } catch (error) {
      log('Failed to save meeting:', error);
      throw error;
    }
  }

  async getMeeting(meetingId: string): Promise<MeetingMinutes | null> {
    try {
      // Find meeting directory
      const dirs = await fs.readdir(this.baseDir);
      const meetingDir = dirs.find(dir => dir.includes(meetingId));
      
      if (!meetingDir) {
        return null;
      }
      
      const minutesPath = path.join(this.baseDir, meetingDir, 'meeting-minutes.json');
      const data = await fs.readFile(minutesPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      log(`Failed to get meeting ${meetingId}:`, error);
      return null;
    }
  }

  async getAllMeetings(): Promise<MeetingMinutes[]> {
    try {
      const meetings: MeetingMinutes[] = [];
      const dirs = await fs.readdir(this.baseDir);
      
      for (const dir of dirs) {
        try {
          const minutesPath = path.join(this.baseDir, dir, 'meeting-minutes.json');
          const data = await fs.readFile(minutesPath, 'utf-8');
          meetings.push(JSON.parse(data));
        } catch (error) {
          // Skip invalid directories
          continue;
        }
      }
      
      return meetings.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      log('Failed to get all meetings:', error);
      return [];
    }
  }

  async saveVideoChunk(
    meetingId: string, 
    videoBuffer: ArrayBuffer, 
    timestamp: number
  ): Promise<void> {
    const folderName = createMeetingFolder(meetingId, new Date());
    const meetingDir = path.join(this.baseDir, sanitizeFilename(folderName));
    
    try {
      await fs.mkdir(meetingDir, { recursive: true });
      
      const chunkPath = path.join(meetingDir, `video-${timestamp}.webm`);
      await fs.writeFile(chunkPath, Buffer.from(videoBuffer));
    } catch (error) {
      log('Failed to save video chunk:', error);
    }
  }

  private generateSummaryMarkdown(meetingMinutes: MeetingMinutes): string {
    const { meetingInfo, summaries, transcript } = meetingMinutes;
    
    let markdown = `# Meeting Minutes: ${meetingInfo.title}\n\n`;
    markdown += `**Date:** ${new Date(meetingInfo.startTime).toLocaleDateString()}\n`;
    markdown += `**Time:** ${new Date(meetingInfo.startTime).toLocaleTimeString()}\n`;
    markdown += `**Duration:** ${this.calculateDuration(transcript)}\n`;
    markdown += `**Participants:** ${meetingInfo.participants.length}\n\n`;
    
    // Participants
    markdown += `## Participants\n\n`;
    meetingInfo.participants.forEach(p => {
      markdown += `- **${p.name}**${p.email ? ` (${p.email})` : ''}${p.isSelf ? ' (You)' : ''}\n`;
    });
    markdown += '\n';
    
    // Summaries
    if (summaries.length > 0) {
      markdown += `## Meeting Summary\n\n`;
      summaries.forEach(summary => {
        markdown += `### ${this.formatTime(summary.startTime)} - ${this.formatTime(summary.endTime)}\n\n`;
        summary.bullets.forEach(bullet => {
          markdown += `- ${bullet}\n`;
        });
        if (summary.keyPoints.length > 0) {
          markdown += `\n**Key Topics:** ${summary.keyPoints.join(', ')}\n`;
        }
        markdown += '\n';
      });
    }
    
    // Action items (if any)
    markdown += `## Action Items\n\n`;
    markdown += `_No action items identified_\n\n`;
    
    // Decisions (if any)
    markdown += `## Decisions Made\n\n`;
    markdown += `_No specific decisions recorded_\n\n`;
    
    markdown += `---\n\n`;
    markdown += `*Generated by MeetAssist - Privacy-first AI meeting assistant*\n`;
    
    return markdown;
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

  private calculateDuration(transcript: any[]): string {
    if (transcript.length === 0) return '0:00';
    
    const lastChunk = transcript[transcript.length - 1];
    return this.formatTime(lastChunk.endTime);
  }
}