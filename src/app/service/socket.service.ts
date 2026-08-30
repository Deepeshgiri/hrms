import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SharedAuthService } from './shared-auth.service';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  // Presence & Typing
  public presenceUpdates$ = new Subject<{ userId: number; isOnline: boolean; lastSeen: string }>();
  public userTyping$ = new Subject<{ conversationId: number; userId: number; userName: string; isTyping: boolean }>();

  // Chat Messages
  public incomingMessage$ = new Subject<any>();
  public messageEdited$ = new Subject<any>();
  public messageDeleted$ = new Subject<any>();
  public reactionsUpdated$ = new Subject<any>();
  public messagesRead$ = new Subject<any>();
  public conversationUpdated$ = new Subject<any>();

  // WebRTC Calling Events
  public incomingCall$ = new Subject<any>();
  public callRinging$ = new Subject<any>();
  public callAccepted$ = new Subject<any>();
  public callRejected$ = new Subject<any>();
  public callEnded$ = new Subject<any>();
  public callUnavailable$ = new Subject<any>();
  public webrtcOffer$ = new Subject<any>();
  public webrtcAnswer$ = new Subject<any>();
  public webrtcIceCandidate$ = new Subject<any>();

  // Total Unread Count
  private totalUnreadSubject = new BehaviorSubject<number>(0);
  public totalUnread$ = this.totalUnreadSubject.asObservable();

  constructor(private auth: SharedAuthService) {
    if (this.auth.isLoggedIn()) {
      this.connect();
    }
  }

  connect(): void {
    const token = this.auth.getToken();
    if (!token || this.socket?.connected) return;

    const socketUrl = window.location.origin;

    this.socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnectedSubject.next(false);
    });

    // Presence
    this.socket.on('presence:update', (data) => this.presenceUpdates$.next(data));

    // Chat
    this.socket.on('chat:user_typing', (data) => this.userTyping$.next(data));
    this.socket.on('chat:receive_message', (data) => this.incomingMessage$.next(data));
    this.socket.on('chat:message_edited', (data) => this.messageEdited$.next(data));
    this.socket.on('chat:message_deleted', (data) => this.messageDeleted$.next(data));
    this.socket.on('chat:reactions_updated', (data) => this.reactionsUpdated$.next(data));
    this.socket.on('chat:messages_read', (data) => this.messagesRead$.next(data));
    this.socket.on('chat:conversation_updated', (data) => this.conversationUpdated$.next(data));

    // Calling
    this.socket.on('call:incoming', (data) => this.incomingCall$.next(data));
    this.socket.on('call:ringing', (data) => this.callRinging$.next(data));
    this.socket.on('call:accepted', (data) => this.callAccepted$.next(data));
    this.socket.on('call:rejected', (data) => this.callRejected$.next(data));
    this.socket.on('call:ended', (data) => this.callEnded$.next(data));
    this.socket.on('call:unavailable', (data) => this.callUnavailable$.next(data));
    this.socket.on('call:webrtc:offer', (data) => this.webrtcOffer$.next(data));
    this.socket.on('call:webrtc:answer', (data) => this.webrtcAnswer$.next(data));
    this.socket.on('call:webrtc:ice_candidate', (data) => this.webrtcIceCandidate$.next(data));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnectedSubject.next(false);
    }
  }

  joinConversation(conversationId: number): void {
    this.socket?.emit('chat:join_conversation', { conversationId });
  }

  leaveConversation(conversationId: number): void {
    this.socket?.emit('chat:leave_conversation', { conversationId });
  }

  sendTyping(conversationId: number, isTyping: boolean): void {
    this.socket?.emit('chat:typing', { conversationId, isTyping });
  }

  markMessagesRead(conversationId: number, messageId?: number): void {
    this.socket?.emit('chat:message_read', { conversationId, messageId });
  }

  setTotalUnread(count: number): void {
    this.totalUnreadSubject.next(count);
  }

  // WebRTC Calling Signaling Dispatch
  initiateCall(receiverId: number, callType: 'audio' | 'video', conversationId?: number): void {
    this.socket?.emit('call:initiate', { receiverId, callType, conversationId });
  }

  acceptCall(callId: number, callerId: number): void {
    this.socket?.emit('call:accept', { callId, callerId });
  }

  rejectCall(callId: number, callerId: number, reason: string = 'declined'): void {
    this.socket?.emit('call:reject', { callId, callerId, reason });
  }

  endCall(callId: number, targetUserId: number, duration: number = 0): void {
    this.socket?.emit('call:end', { callId, targetUserId, duration });
  }

  sendWebRtcOffer(targetUserId: number, sdp: any, callId: number): void {
    this.socket?.emit('call:webrtc:offer', { targetUserId, sdp, callId });
  }

  sendWebRtcAnswer(targetUserId: number, sdp: any, callId: number): void {
    this.socket?.emit('call:webrtc:answer', { targetUserId, sdp, callId });
  }

  sendIceCandidate(targetUserId: number, candidate: any, callId: number): void {
    this.socket?.emit('call:webrtc:ice_candidate', { targetUserId, candidate, callId });
  }
}
