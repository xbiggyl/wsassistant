// Core types shared between extension and server
export interface MeetingInfo {
  id: string;
  title: string;
  startTime: Date;
  participants: Participant[];
  language: LanguageMode;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  isSelf: boolean;
}

export type LanguageMode = 'EN' | 'AR' | 'MIX';

export interface TranscriptChunk {
  id: string;
  startTime: number;
  endTime: number;
  speakerId: string;
  speakerName: string;
  text: string;
  confidence: number;
  language?: string;
}

export interface Summary {
  id: string;
  startTime: number;
  endTime: number;
  bullets: string[];
  keyPoints: string[];
  timestamp: Date;
}

export interface MeetingMinutes {
  meetingInfo: MeetingInfo;
  transcript: TranscriptChunk[];
  summaries: Summary[];
  actionItems: ActionItem[];
  decisions: Decision[];
  createdAt: Date;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface Decision {
  id: string;
  text: string;
  context: string;
  timestamp: Date;
}

// WebSocket message types
export type WSMessage = 
  | MeetingStartMessage
  | AudioChunkMessage
  | VideoChunkMessage
  | TranscriptMessage
  | SummaryMessage
  | ErrorMessage
  | StatusMessage;

export interface MeetingStartMessage {
  type: 'meeting_start';
  payload: MeetingInfo;
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  payload: {
    meetingId: string;
    chunk: ArrayBuffer;
    timestamp: number;
  };
}

export interface VideoChunkMessage {
  type: 'video_chunk';
  payload: {
    meetingId: string;
    chunk: ArrayBuffer;
    timestamp: number;
  };
}

export interface TranscriptMessage {
  type: 'transcript';
  payload: TranscriptChunk;
}

export interface SummaryMessage {
  type: 'summary';
  payload: Summary;
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface StatusMessage {
  type: 'status';
  payload: {
    recording: boolean;
    transcribing: boolean;
    connected: boolean;
  };
}

// Configuration types
export interface ExtensionConfig {
  autoStart: boolean;
  language: LanguageMode;
  summaryInterval: number; // minutes
  emailSettings: EmailConfig;
  whisperModel: WhisperModel;
  summaryProvider: SummaryProvider;
}

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  recipients: string[];
}

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';
export type SummaryProvider = 'local' | 'openai';

// Storage types
export interface StorageData {
  meetings: Record<string, MeetingMinutes>;
  config: ExtensionConfig;
  lastSync: Date;
}