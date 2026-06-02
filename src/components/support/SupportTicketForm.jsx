import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Paperclip, Mic, MicOff, Loader2, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'feature_request', label: '💡 Feature Request' },
  { value: 'billing', label: '💳 Billing Issue' },
  { value: 'urgent', label: '🚨 Urgent' },
  { value: 'general', label: '💬 General' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical 🔴' },
];

const LABELS = {
  en: {
    title: 'Contact Support', subject: 'Subject', message: 'Describe your issue...',
    category: 'Category', priority: 'Priority', attach: 'Attach Files',
    voice: 'Voice Message', send: 'Send Ticket', success: 'Ticket submitted!',
    uploading: 'Uploading...', recording: 'Recording...', stop: 'Stop',
  },
  ar: {
    title: 'تواصل مع الدعم', subject: 'الموضوع', message: 'اشرح مشكلتك...',
    category: 'التصنيف', priority: 'الأولوية', attach: 'إرفاق ملفات',
    voice: 'رسالة صوتية', send: 'إرسال التذكرة', success: 'تم إرسال التذكرة!',
    uploading: 'جاري الرفع...', recording: 'يسجل...', stop: 'إيقاف',
  },
  fa: {
    title: 'پشتیبانی', subject: 'موضوع', message: 'مشکل خود را توضیح دهید...',
    category: 'دسته‌بندی', priority: 'اولویت', attach: 'پیوست فایل',
    voice: 'پیام صوتی', send: 'ارسال تیکت', success: 'تیکت ارسال شد!',
    uploading: 'در حال آپلود...', recording: 'در حال ضبط...', stop: 'توقف',
  },
};

export default function SupportTicketForm({ lang = 'en', onClose }) {
  const lbl = LABELS[lang] || LABELS.en;
  const { user } = useAuth();

  const [form, setForm] = useState({ subject: '', message: '', category: 'general', priority: 'medium' });
  const [attachments, setAttachments] = useState([]);
  const [voiceUrl, setVoiceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef();
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFiles = async (files) => {
    setUploading(true);
    const urls = [];
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push({ name: file.name, url: file_url, type: file.type });
    }
    setAttachments(p => [...p, ...urls]);
    setUploading(false);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      setUploading(true);
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice_message.webm', { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVoiceUrl(file_url);
      setUploading(false);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRef.current = mr;
    mr.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) return;
    setSaving(true);
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    await base44.entities.SupportTicket.create({
      ...form,
      ticket_number: ticketNumber,
      submitted_by: user?.email || '',
      submitted_by_name: user?.full_name || '',
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : '',
      voice_url: voiceUrl,
    });
    // Send notification email
    try {
      await base44.integrations.Core.SendEmail({
        to: user?.email || '',
        subject: `Support Ticket ${ticketNumber} Received`,
        body: `Your support ticket has been received.\n\nSubject: ${form.subject}\nPriority: ${form.priority}\nCategory: ${form.category}\n\nWe'll get back to you shortly.`,
      });
    } catch {}
    setSaving(false);
    setSubmitted(true);
    setTimeout(() => onClose?.(), 2500);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="text-lg font-semibold text-emerald-700">{lbl.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{lbl.category}</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{lbl.priority}</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">{lbl.subject}</Label>
        <Input value={form.subject} onChange={e => set('subject', e.target.value)} required className="h-10" placeholder={lbl.subject} />
      </div>

      <div>
        <Label className="text-xs">{lbl.message}</Label>
        <textarea
          value={form.message}
          onChange={e => set('message', e.target.value)}
          required
          rows={5}
          placeholder={lbl.message}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            <span className="text-xs">{lbl.attach}</span>
          </Button>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.xlsx,.csv" className="hidden" onChange={e => handleFiles(e.target.files)} />

          {!voiceUrl && (
            <Button type="button" variant={recording ? 'destructive' : 'outline'} size="sm"
              onClick={recording ? stopRecording : startRecording} disabled={uploading}>
              {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span className="text-xs">{recording ? lbl.stop : lbl.voice}</span>
            </Button>
          )}
          {recording && <span className="text-xs text-red-500 animate-pulse self-center">⏺ {lbl.recording}</span>}
        </div>

        {/* Voice playback */}
        {voiceUrl && (
          <div className="bg-muted rounded-lg p-2 flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <audio controls src={voiceUrl} className="h-8 flex-1" />
          </div>
        )}

        {/* File list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1 bg-secondary text-xs rounded px-2 py-1">
                {att.type?.startsWith('image') ? (
                  <img src={att.url} alt="" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <Paperclip className="w-3 h-3" />
                )}
                <span className="max-w-[80px] truncate">{att.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full h-11 font-semibold" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {lbl.send}
      </Button>
    </form>
  );
}