import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Gateway de eventos en tiempo real: estado de uploads y notificaciones de
 * moderación. Ver specs 007 y 008. La autenticación del socket y los rooms por
 * rol se implementan en la fase TDD.
 */
@WebSocketGateway({
  namespace: 'events',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitUploadStatus(uploadJobId: string, status: string): void {
    this.server.emit('upload:status', { uploadJobId, status });
  }

  emitModerationEvent(payload: Record<string, unknown>): void {
    this.server.emit('moderation:event', payload);
  }
}
