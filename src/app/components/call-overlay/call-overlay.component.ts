import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { WebrtcService, CallState } from 'src/app/service/webrtc.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-call-overlay',
  templateUrl: './call-overlay.component.html',
  styleUrls: ['./call-overlay.component.css']
})
export class CallOverlayComponent implements OnInit, OnDestroy {
  callState: CallState = 'idle';
  callData: any = null;
  callDuration: string = '00:00';
  isAudioMuted: boolean = false;
  isVideoOff: boolean = false;

  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;

  private subs: Subscription[] = [];

  constructor(public webrtc: WebrtcService) {}

  ngOnInit(): void {
    this.subs.push(
      this.webrtc.callState$.subscribe((state) => {
        this.callState = state;
      }),
      this.webrtc.activeCallData$.subscribe((data) => {
        this.callData = data;
      }),
      this.webrtc.callSeconds$.subscribe((sec) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        this.callDuration = `${m}:${s}`;
      }),
      this.webrtc.localStream$.subscribe((stream) => {
        if (this.localVideoRef?.nativeElement && stream) {
          this.localVideoRef.nativeElement.srcObject = stream;
        }
      }),
      this.webrtc.remoteStream$.subscribe((stream) => {
        if (this.remoteVideoRef?.nativeElement && stream) {
          this.remoteVideoRef.nativeElement.srcObject = stream;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  get partnerName(): string {
    if (this.callData?.isOutgoing) {
      return this.callData?.partner?.name || 'User';
    }
    return this.callData?.caller?.name || 'Incoming Call';
  }

  get isVideoCall(): boolean {
    return this.callData?.callType === 'video';
  }

  answer(): void {
    this.webrtc.answerCall();
  }

  reject(): void {
    this.webrtc.rejectCall();
  }

  hangUp(): void {
    this.webrtc.hangUp();
  }

  toggleMute(): void {
    this.isAudioMuted = this.webrtc.toggleAudioMute();
  }

  toggleVideo(): void {
    this.isVideoOff = this.webrtc.toggleVideo();
  }
}
