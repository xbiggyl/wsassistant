import { EventEmitter } from 'events';
import { createLogger, generateId } from '@shared';
import type { 
  MeetingInfo, 
  TranscriptChunk, 
  Summary, 
  MeetingMinutes,
  WSMessage 
} from '@shared';

const log = createLogger('meeting-manager');

interface Services {
  storage: any;
  transcription: any;
  summary: any;
  email: any;
}

export class MeetingManager extends EventEmitter {
  private activeMeetings = new Map<string, ActiveMeeting>();
  private clientMeetings = new Map<string, string>(); // clientId -> meetingId
  private services: Services;

  constructor(services: Services) {
    super();
    this.services = services;
  }

  async startMeeting(
    meetingInfo: MeetingInfo, 
    ws: any, 
    clientId: string
  ): Promise<void> {
    log(`Starting meeting: ${meetingInfo.id}`);

    const activeMeeting: ActiveMeeting = {
      info: meetingInfo,
      startTime: new Date(),
      clients: new Set([clientId]),
      audioBuffers: [],
      videoChunks: [],
      transcript: [],
      summaries: [],
      lastSummaryTime: 0
    };

    this.activeMeetings.set(meetingInfo.id, activeMeeting);
    this.clientMeetings.set(clientId, meetingInfo.id);

    // Start processing pipeline
    this.startTranscriptionPipeline(meetingInfo.id);
    this.startSummaryPipeline(meetingInfo.id);

    // Send confirmation
    this.sendToMeetingClients(meetingInfo.id, {
      type: 'status',
      payload: {
        recording: true,
        transcribing: true,
        connected: true
      }
    });

    log(`Meeting ${meetingInfo.id} started with ${activeMeeting.clients.size} clients`);
  }

  async processAudioChunk(
    meetingId: string, 
    audioBuffer: ArrayBuffer, 
    timestamp: number
  ): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) {
      log(`No active meeting found: ${meetingId}`);
      return;
    }

    // Add to audio buffer
    meeting.audioBuffers.push({
      data: audioBuffer,
      timestamp
    });

    // Process when we have enough audio (e.g., 10 seconds)
    const totalDuration = this.calculateAudioDuration(meeting.audioBuffers);
    if (totalDuration >= 10000) { // 10 seconds
      await this.processAudioForTranscription(meetingId);
    }
  }

  async processVideoChunk(
    meetingId: string, 
    videoBuffer: ArrayBuffer, 
    timestamp: number
  ): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    meeting.videoChunks.push({
      data: videoBuffer,
      timestamp
    });

    // Save video chunks to storage
    await this.services.storage.saveVideoChunk(meetingId, videoBuffer, timestamp);
  }

  private async processAudioForTranscription(meetingId: string): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting || meeting.audioBuffers.length === 0) return;

    try {
      // Merge audio buffers
      const mergedAudio = this.mergeAudioBuffers(meeting.audioBuffers);
      
      // Send to transcription service
      const transcriptChunks = await this.services.transcription.transcribe(
        mergedAudio,
        meeting.info.language
      );

      // Map speakers using meeting participant info
      const mappedChunks = this.mapSpeakers(transcriptChunks, meeting.info.participants);

      // Add to meeting transcript
      meeting.transcript.push(...mappedChunks);

      // Send to clients
      mappedChunks.forEach(chunk => {
        this.sendToMeetingClients(meetingId, {
          type: 'transcript',
          payload: chunk
        });
      });

      // Clear processed audio buffers
      meeting.audioBuffers.splice(0, meeting.audioBuffers.length);

      log(`Processed ${mappedChunks.length} transcript chunks for meeting ${meetingId}`);
    } catch (error) {
      log(`Failed to process audio for meeting ${meetingId}:`, error);
    }
  }

  private async startSummaryPipeline(meetingId: string): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    // Set up 5-minute summary interval
    const summaryInterval = setInterval(async () => {
      if (!this.activeMeetings.has(meetingId)) {
        clearInterval(summaryInterval);
        return;
      }

      await this.generateSummary(meetingId);
    }, 5 * 60 * 1000); // 5 minutes

    // Store interval reference for cleanup
    (meeting as any).summaryInterval = summaryInterval;
  }

  private async generateSummary(meetingId: string): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    const currentTime = Date.now();
    const recentTranscript = meeting.transcript.filter(
      chunk => chunk.startTime >= meeting.lastSummaryTime
    );

    if (recentTranscript.length === 0) return;

    try {
      const summary = await this.services.summary.generateSummary(
        recentTranscript,
        meeting.lastSummaryTime,
        currentTime
      );

      meeting.summaries.push(summary);
      meeting.lastSummaryTime = currentTime;

      // Send to clients
      this.sendToMeetingClients(meetingId, {
        type: 'summary',
        payload: summary
      });

      log(`Generated summary for meeting ${meetingId}`);
    } catch (error) {
      log(`Failed to generate summary for meeting ${meetingId}:`, error);
    }
  }

  async endMeeting(meetingId: string): Promise<void> {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    log(`Ending meeting: ${meetingId}`);

    // Clear summary interval
    if ((meeting as any).summaryInterval) {
      clearInterval((meeting as any).summaryInterval);
    }

    // Generate final meeting minutes
    const meetingMinutes: MeetingMinutes = {
      meetingInfo: meeting.info,
      transcript: meeting.transcript,
      summaries: meeting.summaries,
      actionItems: [], // TODO: Extract from summaries
      decisions: [], // TODO: Extract from summaries
      createdAt: new Date()
    };

    // Save to storage
    await this.services.storage.saveMeeting(meetingMinutes);

    // Send meeting minutes via email
    if (meeting.info.participants.some(p => p.email)) {
      await this.services.email.sendMeetingMinutes(meetingMinutes);
    }

    // Cleanup
    this.activeMeetings.delete(meetingId);
    
    // Remove client mappings
    for (const [clientId, mappedMeetingId] of this.clientMeetings.entries()) {
      if (mappedMeetingId === meetingId) {
        this.clientMeetings.delete(clientId);
      }
    }

    log(`Meeting ${meetingId} ended and cleaned up`);
  }

  handleClientDisconnect(clientId: string): void {
    const meetingId = this.clientMeetings.get(clientId);
    if (!meetingId) return;

    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    meeting.clients.delete(clientId);
    this.clientMeetings.delete(clientId);

    // If no clients left, end the meeting
    if (meeting.clients.size === 0) {
      this.endMeeting(meetingId);
    }

    log(`Client ${clientId} disconnected from meeting ${meetingId}`);
  }

  private sendToMeetingClients(meetingId: string, message: WSMessage): void {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    // In a real implementation, you'd need to maintain WebSocket references
    // For now, this is a placeholder for the messaging system
    this.emit('message', { meetingId, message });
  }

  private calculateAudioDuration(buffers: AudioBuffer[]): number {
    return buffers.reduce((total, buffer) => total + buffer.timestamp, 0);
  }

  private mergeAudioBuffers(buffers: AudioBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.data.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer.data), offset);
      offset += buffer.data.byteLength;
    }

    return result.buffer;
  }

  private mapSpeakers(
    chunks: TranscriptChunk[], 
    participants: any[]
  ): TranscriptChunk[] {
    // Simple speaker mapping - in reality this would be more sophisticated
    return chunks.map(chunk => ({
      ...chunk,
      speakerName: participants.find(p => p.id === chunk.speakerId)?.name || 'Unknown Speaker'
    }));
  }

  private startTranscriptionPipeline(meetingId: string): void {
    // Start real-time transcription pipeline
    log(`Started transcription pipeline for meeting ${meetingId}`);
  }

  async cleanup(): Promise<void> {
    // End all active meetings
    const meetingIds = Array.from(this.activeMeetings.keys());
    await Promise.all(meetingIds.map(id => this.endMeeting(id)));
  }
}

interface ActiveMeeting {
  info: MeetingInfo;
  startTime: Date;
  clients: Set<string>;
  audioBuffers: AudioBuffer[];
  videoChunks: VideoChunk[];
  transcript: TranscriptChunk[];
  summaries: Summary[];
  lastSummaryTime: number;
}

interface AudioBuffer {
  data: ArrayBuffer;
  timestamp: number;
}

interface VideoChunk {
  data: ArrayBuffer;
  timestamp: number;
}