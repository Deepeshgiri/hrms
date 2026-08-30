import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SocketService } from './socket.service';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

@Injectable({
  providedIn: 'root',
})
export class WebrtcService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  private callStateSubject = new BehaviorSubject<CallState>('idle');
  public callState$ = this.callStateSubject.asObservable();

  private activeCallDataSubject = new BehaviorSubject<any>(null);
  public activeCallData$ = this.activeCallDataSubject.asObservable();

  private localStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  public localStream$ = this.localStreamSubject.asObservable();

  private remoteStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  public remoteStream$ = this.remoteStreamSubject.asObservable();

  // Media Mute States
  public isAudioMuted: boolean = false;
  public isVideoOff: boolean = false;

  // Call duration timer
  private durationInterval: any = null;
  private callSecondsSubject = new BehaviorSubject<number>(0);
  public callSeconds$ = this.callSecondsSubject.asObservable();

  constructor(private socketService: SocketService) {
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // 1. Incoming call
    this.socketService.incomingCall$.subscribe((data) => {
      this.activeCallDataSubject.next(data);
      this.callStateSubject.next('incoming');
    });

    // 2. Call Ringing (for Caller)
    this.socketService.callRinging$.subscribe((data) => {
      if (this.callStateSubject.value === 'calling') {
        const current = this.activeCallDataSubject.value || {};
        this.activeCallDataSubject.next({ ...current, ...data, isRinging: true });
      }
    });

    // 3. Call Accepted (by Receiver -> Caller initiates SDP Offer)
    this.socketService.callAccepted$.subscribe(async (data) => {
      if (this.callStateSubject.value === 'calling') {
        await this.createAndSendOffer();
      }
    });

    // 4. Call Rejected
    this.socketService.callRejected$.subscribe(() => {
      this.endCallCleanup();
    });

    // 5. Call Ended
    this.socketService.callEnded$.subscribe(() => {
      this.endCallCleanup();
    });

    // 6. User Unavailable
    this.socketService.callUnavailable$.subscribe(() => {
      this.endCallCleanup();
    });

    // 7. WebRTC Offer received (Receiver creates SDP Answer)
    this.socketService.webrtcOffer$.subscribe(async ({ callerId, sdp, callId }) => {
      await this.handleReceivedOffer(callerId, sdp, callId);
    });

    // 8. WebRTC Answer received (Caller sets Remote Description)
    this.socketService.webrtcAnswer$.subscribe(async ({ sdp }) => {
      if (this.peerConnection && sdp) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        this.callStateSubject.next('connected');
        this.startCallTimer();
      }
    });

    // 9. ICE Candidate received
    this.socketService.webrtcIceCandidate$.subscribe(async ({ candidate }) => {
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });
  }

  // --- Start Outgoing Call ---
  async startCall(targetUser: { userId: number; name: string }, callType: 'audio' | 'video', conversationId?: number): Promise<void> {
    try {
      this.isAudioMuted = false;
      this.isVideoOff = callType === 'audio';

      // Capture local media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      this.localStreamSubject.next(this.localStream);

      this.activeCallDataSubject.next({
        partner: targetUser,
        callType,
        isOutgoing: true,
        conversationId,
      });

      this.callStateSubject.next('calling');
      this.socketService.initiateCall(targetUser.userId, callType, conversationId);
    } catch (err) {
      console.error('Failed to get media devices:', err);
      alert('Could not access microphone/camera. Please grant media permissions.');
      this.endCallCleanup();
    }
  }

  // --- Answer Incoming Call ---
  async answerCall(): Promise<void> {
    const callData = this.activeCallDataSubject.value;
    if (!callData) return;

    try {
      this.isAudioMuted = false;
      this.isVideoOff = callData.callType === 'audio';

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callData.callType === 'video',
      });
      this.localStreamSubject.next(this.localStream);

      this.socketService.acceptCall(callData.callId, callData.caller.userId);
    } catch (err) {
      console.error('Failed to get media devices on answer:', err);
      this.rejectCall();
    }
  }

  // --- Reject Incoming Call ---
  rejectCall(): void {
    const callData = this.activeCallDataSubject.value;
    if (callData) {
      this.socketService.rejectCall(callData.callId, callData.caller.userId);
    }
    this.endCallCleanup();
  }

  // --- Hang Up / End Call ---
  hangUp(): void {
    const callData = this.activeCallDataSubject.value;
    const duration = this.callSecondsSubject.value;

    if (callData) {
      const targetUserId = callData.isOutgoing ? callData.partner?.userId : callData.caller?.userId;
      this.socketService.endCall(callData.callId, targetUserId, duration);
    }
    this.endCallCleanup();
  }

  // --- Create PeerConnection & Send Offer ---
  private async createAndSendOffer(): Promise<void> {
    this.initPeerConnection();

    const callData = this.activeCallDataSubject.value;
    const targetUserId = callData?.partner?.userId;

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    this.socketService.sendWebRtcOffer(targetUserId, offer, callData?.callId);
  }

  // --- Handle Received Offer & Send Answer ---
  private async handleReceivedOffer(callerId: number, sdp: any, callId: number): Promise<void> {
    this.initPeerConnection();

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    this.socketService.sendWebRtcAnswer(callerId, answer, callId);
    this.callStateSubject.next('connected');
    this.startCallTimer();
  }

  private initPeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();
    this.remoteStreamSubject.next(this.remoteStream);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      this.remoteStreamSubject.next(this.remoteStream);
    };

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const callData = this.activeCallDataSubject.value;
        const targetUserId = callData?.isOutgoing ? callData.partner?.userId : callData?.caller?.userId;
        if (targetUserId) {
          this.socketService.sendIceCandidate(targetUserId, event.candidate, callData.callId);
        }
      }
    };
  }

  // Toggle Mute Audio
  toggleAudioMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioMuted = !audioTrack.enabled;
      }
    }
    return this.isAudioMuted;
  }

  // Toggle Video Camera
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoOff = !videoTrack.enabled;
      }
    }
    return this.isVideoOff;
  }

  private startCallTimer(): void {
    this.stopCallTimer();
    this.callSecondsSubject.next(0);
    this.durationInterval = setInterval(() => {
      this.callSecondsSubject.next(this.callSecondsSubject.value + 1);
    }, 1000);
  }

  private stopCallTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private endCallCleanup(): void {
    this.stopCallTimer();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      this.localStreamSubject.next(null);
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.remoteStreamSubject.next(null);
    this.callStateSubject.next('idle');
    this.activeCallDataSubject.next(null);
    this.callSecondsSubject.next(0);
  }
}
