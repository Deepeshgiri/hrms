import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { SocketService } from 'src/app/service/socket.service';
import { WebrtcService } from 'src/app/service/webrtc.service';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { AppConstants } from 'src/app/AppConstants';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  conversations: any[] = [];
  filteredConversations: any[] = [];
  activeConversation: any = null;
  messages: any[] = [];
  users: any[] = [];
  callHistory: any[] = [];

  // Active view: 'chats' | 'calls'
  activeTab: 'chats' | 'calls' = 'chats';

  // Search & Filters
  searchQuery: string = '';

  // Message input
  newMessageText: string = '';
  replyingTo: any = null;
  editingMessage: any = null;

  // Modals & UI Toggles
  showNewChatModal: boolean = false;
  showNewGroupModal: boolean = false;
  showEmojiPicker: boolean = false;
  showMediaViewer: boolean = false;
  activeMedia: any = null;

  // New Group Form
  groupName: string = '';
  groupDescription: string = '';
  selectedGroupMembers: number[] = [];

  // Voice Note Recording
  isRecordingVoice: boolean = false;
  recordingSeconds: number = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingInterval: any = null;

  // Typing timer
  private typingTimeout: any = null;
  isPartnerTyping: boolean = false;

  // Scrolling
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  private shouldScrollToBottom: boolean = false;

  private subs: Subscription[] = [];

  readonly EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '✅', '🚀', '💯'];

  constructor(
    private coreService: CoreService,
    public socketService: SocketService,
    public webrtcService: WebrtcService,
    public auth: SharedAuthService
  ) {}

  ngOnInit(): void {
    this.loadConversations();
    this.loadUsers();
    this.loadCallHistory();
    this.setupSocketSubscribers();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.activeConversation) {
      this.socketService.leaveConversation(this.activeConversation.id);
    }
    this.cancelVoiceRecording();
  }

  setupSocketSubscribers(): void {
    // 1. Incoming Message
    this.subs.push(
      this.socketService.incomingMessage$.subscribe((msg) => {
        if (this.activeConversation && msg.conversationId === this.activeConversation.id) {
          // Check if message already exists
          const exists = this.messages.some(m => m.id === msg.id);
          if (!exists) {
            this.messages.push(msg);
            this.shouldScrollToBottom = true;
            this.socketService.markMessagesRead(this.activeConversation.id, msg.id);
          }
        }
        this.updateConversationLastMessage(msg);
      }),

      // 2. User Typing
      this.socketService.userTyping$.subscribe((data) => {
        if (this.activeConversation && data.conversationId === this.activeConversation.id && data.userId !== this.auth.getUserId()) {
          this.isPartnerTyping = data.isTyping;
        }
      }),

      // 3. Presence Updates
      this.socketService.presenceUpdates$.subscribe((data) => {
        this.updateUserPresence(data.userId, data.isOnline, data.lastSeen);
      }),

      // 4. Reactions
      this.socketService.reactionsUpdated$.subscribe((data) => {
        if (this.activeConversation && data.conversationId === this.activeConversation.id) {
          const msg = this.messages.find(m => m.id === data.messageId);
          if (msg) msg.reactions = data.reactions;
        }
      }),

      // 5. Message Edited
      this.socketService.messageEdited$.subscribe((data) => {
        if (this.activeConversation && data.conversationId === this.activeConversation.id) {
          const msg = this.messages.find(m => m.id === data.messageId);
          if (msg) {
            msg.content = data.content;
            msg.isEdited = true;
          }
        }
      }),

      // 6. Message Deleted
      this.socketService.messageDeleted$.subscribe((data) => {
        if (this.activeConversation && data.conversationId === this.activeConversation.id) {
          const msg = this.messages.find(m => m.id === data.messageId);
          if (msg) {
            msg.isDeleted = true;
            msg.content = 'This message was deleted';
          }
        }
      }),

      // 7. Messages Read
      this.socketService.messagesRead$.subscribe((data) => {
        if (this.activeConversation && data.conversationId === this.activeConversation.id) {
          this.messages.forEach(m => {
            if (m.senderId === this.auth.getUserId()) m.status = 'read';
          });
        }
      })
    );
  }

  loadConversations(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}chat/conversations`).subscribe({
      next: (data: any[]) => {
        this.conversations = data || [];
        this.filterConversations();
        this.calculateTotalUnread();
      },
      error: () => {}
    });
  }

  loadUsers(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}chat/users`).subscribe({
      next: (data: any[]) => {
        this.users = data || [];
      },
      error: () => {}
    });
  }

  loadCallHistory(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}chat/calls/history`).subscribe({
      next: (data: any[]) => {
        this.callHistory = data || [];
      },
      error: () => {}
    });
  }

  selectConversation(conv: any): void {
    if (this.activeConversation) {
      this.socketService.leaveConversation(this.activeConversation.id);
    }

    this.activeConversation = conv;
    conv.unreadCount = 0;
    this.calculateTotalUnread();
    this.messages = [];
    this.isPartnerTyping = false;
    this.replyingTo = null;
    this.editingMessage = null;

    this.socketService.joinConversation(conv.id);
    this.loadMessages(conv.id);
  }

  loadMessages(conversationId: number): void {
    this.coreService.getRequest(`${AppConstants.API_URL}chat/conversations/${conversationId}/messages?limit=100`).subscribe({
      next: (data: any[]) => {
        this.messages = data || [];
        this.shouldScrollToBottom = true;

        if (this.messages.length > 0) {
          const lastMsg = this.messages[this.messages.length - 1];
          this.socketService.markMessagesRead(conversationId, lastMsg.id);
        }
      },
      error: () => {}
    });
  }

  sendMessage(): void {
    if (!this.newMessageText.trim() || !this.activeConversation) return;

    if (this.editingMessage) {
      // Edit existing message
      this.coreService.putRequest(`${AppConstants.API_URL}chat/messages/${this.editingMessage.id}`, {
        content: this.newMessageText.trim()
      }).subscribe({
        next: () => {
          this.editingMessage = null;
          this.newMessageText = '';
        }
      });
      return;
    }

    const payload = {
      content: this.newMessageText.trim(),
      messageType: 'text',
      replyToId: this.replyingTo?.id || null
    };

    this.coreService.postRequest(`${AppConstants.API_URL}chat/conversations/${this.activeConversation.id}/messages`, payload).subscribe({
      next: (msg: any) => {
        this.newMessageText = '';
        this.replyingTo = null;
        this.sendTypingStatus(false);
      },
      error: () => {}
    });
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    } else {
      this.sendTypingStatus(true);
    }
  }

  sendTypingStatus(isTyping: boolean): void {
    if (!this.activeConversation) return;
    this.socketService.sendTyping(this.activeConversation.id, isTyping);

    if (isTyping) {
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.socketService.sendTyping(this.activeConversation.id, false);
      }, 2500);
    }
  }

  // --- Voice Note Recording ---
  async startVoiceRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (this.audioChunks.length > 0 && this.isRecordingVoice) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          await this.uploadAndSendVoiceNote(audioBlob);
        }
        this.isRecordingVoice = false;
      };

      this.mediaRecorder.start();
      this.isRecordingVoice = true;
      this.recordingSeconds = 0;
      this.recordingInterval = setInterval(() => {
        this.recordingSeconds++;
      }, 1000);
    } catch {
      alert('Could not access microphone for voice message');
    }
  }

  stopAndSendVoiceNote(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      clearInterval(this.recordingInterval);
      this.mediaRecorder.stop();
    }
  }

  cancelVoiceRecording(): void {
    this.isRecordingVoice = false;
    clearInterval(this.recordingInterval);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.audioChunks = [];
  }

  async uploadAndSendVoiceNote(blob: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('file', blob, `voice_${Date.now()}.webm`);

    this.coreService.postRequest(`${AppConstants.API_URL}chat/upload`, formData).subscribe({
      next: (res: any) => {
        if (res.fileUrl && this.activeConversation) {
          const payload = {
            content: 'Voice message',
            messageType: 'voice',
            attachments: [{
              fileName: res.fileName,
              fileUrl: res.fileUrl,
              fileType: 'voice',
              fileSize: res.fileSize,
              duration: this.recordingSeconds
            }]
          };
          this.coreService.postRequest(`${AppConstants.API_URL}chat/conversations/${this.activeConversation.id}/messages`, payload).subscribe();
        }
      }
    });
  }

  // --- Attachments / Media Upload ---
  onFileUpload(event: any): void {
    const file = event.target?.files?.[0];
    if (!file || !this.activeConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    this.coreService.postRequest(`${AppConstants.API_URL}chat/upload`, formData).subscribe({
      next: (res: any) => {
        if (res.fileUrl) {
          const payload = {
            content: file.name,
            messageType: res.fileType,
            attachments: [{
              fileName: res.fileName,
              fileUrl: res.fileUrl,
              fileType: res.fileType,
              fileSize: res.fileSize
            }]
          };
          this.coreService.postRequest(`${AppConstants.API_URL}chat/conversations/${this.activeConversation.id}/messages`, payload).subscribe();
        }
      }
    });
  }

  // --- Reactions ---
  toggleReaction(message: any, emoji: string): void {
    this.coreService.postRequest(`${AppConstants.API_URL}chat/messages/${message.id}/react`, { emoji }).subscribe();
  }

  // --- Edit / Delete / Reply ---
  replyMessage(msg: any): void {
    this.replyingTo = msg;
    this.editingMessage = null;
  }

  editMessage(msg: any): void {
    this.editingMessage = msg;
    this.newMessageText = msg.content;
    this.replyingTo = null;
  }

  deleteMessage(msg: any): void {
    if (confirm('Delete this message?')) {
      this.coreService.deleteRequest(`${AppConstants.API_URL}chat/messages/${msg.id}`).subscribe();
    }
  }

  // --- Start Direct Chat / Group ---
  startDirectChatWithUser(user: any): void {
    this.showNewChatModal = false;
    this.coreService.postRequest(`${AppConstants.API_URL}chat/conversations/direct`, {
      targetUserId: user.userId || user.id
    }).subscribe({
      next: (res: any) => {
        this.loadConversations();
        setTimeout(() => {
          const conv = this.conversations.find(c => c.id === res.conversationId);
          if (conv) this.selectConversation(conv);
        }, 300);
      }
    });
  }

  createGroup(): void {
    if (!this.groupName.trim()) return;

    this.coreService.postRequest(`${AppConstants.API_URL}chat/conversations/group`, {
      name: this.groupName.trim(),
      description: this.groupDescription,
      memberIds: this.selectedGroupMembers
    }).subscribe({
      next: (res: any) => {
        this.showNewGroupModal = false;
        this.groupName = '';
        this.groupDescription = '';
        this.selectedGroupMembers = [];
        this.loadConversations();
      }
    });
  }

  toggleGroupMember(userId: number): void {
    const idx = this.selectedGroupMembers.indexOf(userId);
    if (idx > -1) {
      this.selectedGroupMembers.splice(idx, 1);
    } else {
      this.selectedGroupMembers.push(userId);
    }
  }

  // --- WebRTC Audio & Video Calling ---
  startCall(callType: 'audio' | 'video'): void {
    if (!this.activeConversation) return;

    const partner = this.activeConversation.partner;
    if (!partner) {
      alert('Group calling is available for 1-to-1 chats');
      return;
    }

    this.webrtcService.startCall(
      { userId: partner.userId, name: partner.name },
      callType,
      this.activeConversation.id
    );
  }

  callFromHistory(call: any, callType: 'audio' | 'video'): void {
    this.webrtcService.startCall(
      { userId: call.partnerId, name: call.partnerName },
      callType
    );
  }

  // --- Helpers ---
  filterConversations(): void {
    if (!this.searchQuery) {
      this.filteredConversations = [...this.conversations];
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredConversations = this.conversations.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.lastMessageText?.toLowerCase().includes(q)
    );
  }

  private updateConversationLastMessage(msg: any): void {
    const conv = this.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.lastMessageText = msg.messageType === 'image' ? '📷 Photo' : (msg.messageType === 'voice' ? '🎤 Voice' : msg.content);
      conv.lastMessageAt = msg.created_at;
      if (!this.activeConversation || this.activeConversation.id !== conv.id) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
      this.calculateTotalUnread();
    } else {
      this.loadConversations();
    }
  }

  private updateUserPresence(userId: number, isOnline: boolean, lastSeen: string): void {
    this.conversations.forEach(c => {
      if (c.partner && c.partner.userId === userId) {
        c.partner.isOnline = isOnline;
        c.partner.lastSeen = lastSeen;
      }
    });
    this.users.forEach(u => {
      if (u.userId === userId) {
        u.isOnline = isOnline;
        u.lastSeen = lastSeen;
      }
    });
  }

  private calculateTotalUnread(): void {
    const total = this.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    this.socketService.setTotalUnread(total);
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  getAvatarColor(name: string): string {
    const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] || 'U').toUpperCase();
  }

  formatVoiceTime(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
