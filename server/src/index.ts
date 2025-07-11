import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import { createLogger } from '@shared';
import { MeetingManager } from './meeting/MeetingManager.js';
import { TranscriptionService } from './stt/TranscriptionService.js';
import { SummaryService } from './summary/SummaryService.js';
import { EmailService } from './email/EmailService.js';
import { StorageService } from './storage/StorageService.js';
import type { WSMessage } from '@shared';

// Load environment variables
config();

const log = createLogger('server');

class MeetAssistServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private meetingManager: MeetingManager;
  private transcriptionService: TranscriptionService;
  private summaryService: SummaryService;
  private emailService: EmailService;
  private storageService: StorageService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    
    // Initialize services
    this.storageService = new StorageService();
    this.transcriptionService = new TranscriptionService();
    this.summaryService = new SummaryService();
    this.emailService = new EmailService();
    this.meetingManager = new MeetingManager({
      storage: this.storageService,
      transcription: this.transcriptionService,
      summary: this.summaryService,
      email: this.emailService
    });

    this.setupExpress();
    this.setupWebSocket();
  }

  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
          transcription: this.transcriptionService.isReady(),
          summary: this.summaryService.isReady(),
          summaryProvider: this.summaryService.getProvider(),
          email: this.emailService.isReady()
        },
        config: {
          summaryProvider: process.env.SUMMARY_PROVIDER || 'local',
          whisperModel: process.env.WHISPER_MODEL || 'tiny-int8',
          summaryInterval: process.env.SUMMARY_INTERVAL_MINUTES || '5'
        }
      });
    });

    // Meeting endpoints
    this.app.get('/api/meetings', async (req, res) => {
      try {
        const meetings = await this.storageService.getAllMeetings();
        res.json(meetings);
      } catch (error) {
        log('Failed to get meetings:', error);
        res.status(500).json({ error: 'Failed to get meetings' });
      }
    });

    this.app.get('/api/meetings/:id', async (req, res) => {
      try {
        const meeting = await this.storageService.getMeeting(req.params.id);
        if (!meeting) {
          return res.status(404).json({ error: 'Meeting not found' });
        }
        res.json(meeting);
      } catch (error) {
        log('Failed to get meeting:', error);
        res.status(500).json({ error: 'Failed to get meeting' });
      }
    });

    // Configuration endpoint
    this.app.get('/api/config', (req, res) => {
      res.json({
        summaryProvider: process.env.SUMMARY_PROVIDER || 'local',
        summaryInterval: parseInt(process.env.SUMMARY_INTERVAL_MINUTES || '5'),
        whisperModel: process.env.WHISPER_MODEL || 'tiny-int8',
        supportedLanguages: ['EN', 'AR', 'MIX']
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      log(`Client connected: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message, clientId);
        } catch (error) {
          log('Failed to handle WebSocket message:', error);
          this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        log(`Client disconnected: ${clientId}`);
        this.meetingManager.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        log(`WebSocket error for client ${clientId}:`, error);
      });

      // Send connection confirmation
      this.sendMessage(ws, {
        type: 'status',
        payload: {
          recording: false,
          transcribing: false,
          connected: true
        }
      });
    });
  }

  private async handleWebSocketMessage(
    ws: any, 
    message: WSMessage, 
    clientId: string
  ): Promise<void> {
    log(`Received message from ${clientId}:`, message.type);

    switch (message.type) {
      case 'meeting_start':
        await this.meetingManager.startMeeting(message.payload, ws, clientId);
        break;

      case 'audio_chunk':
        await this.meetingManager.processAudioChunk(
          message.payload.meetingId,
          message.payload.chunk,
          message.payload.timestamp
        );
        break;

      case 'video_chunk':
        await this.meetingManager.processVideoChunk(
          message.payload.meetingId,
          message.payload.chunk,
          message.payload.timestamp
        );
        break;

      default:
        log(`Unknown message type: ${(message as any).type}`);
    }
  }

  private sendMessage(ws: any, message: WSMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: any, code: string, message: string, details?: any): void {
    this.sendMessage(ws, {
      type: 'error',
      payload: { code, message, details }
    });
  }

  public async start(port: number = 3001): Promise<void> {
    try {
      // Initialize all services
      await this.storageService.initialize();
      await this.transcriptionService.initialize();
      await this.summaryService.initialize();
      await this.emailService.initialize();
      
      this.server.listen(port, () => {
        log(`MeetAssist server started on port ${port}`);
        log('WebSocket endpoint: ws://localhost:3001/ws');
        log('Health check: http://localhost:3001/health');
        log(`Summary provider: ${this.summaryService.getProvider()}`);
      });
    } catch (error) {
      log('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    log('Shutting down server...');
    
    this.wss.close();
    this.server.close();
    
    await this.meetingManager.cleanup();
    await this.transcriptionService.cleanup();
    await this.summaryService.cleanup();
    
    log('Server shutdown complete');
  }
}

// Start the server
const server = new MeetAssistServer();

process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default MeetAssistServer;