import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import { Send, Bot, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';

const SETTING_KEY = 'telegram_notification_settings';

const DEFAULT_SETTINGS = {
  enabled: false,
  bot_token: '',
  chat_id: '',
};

export default function TelegramSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // null | 'success' | 'error'
  const [testError, setTestError] = useState('');

  // Load existing settings from app_settings
  useEffect(() => {
    base44.entities.AppSettings.filter({ key: SETTING_KEY }, '-created_date', 1)
      .then(rows => {
        if (rows[0]?.value) {
          try {
            const parsed = JSON.parse(rows[0].value);
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            setExistingId(rows[0].id);
          } catch {
            // malformed JSON — use defaults
          }
        }
      })
      .catch(err => console.warn('[TelegramSettings] load error:', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      key: SETTING_KEY,
      value: JSON.stringify(settings),
    };
    try {
      if (existingId) {
        await base44.entities.AppSettings.update(existingId, payload);
      } else {
        const created = await base44.entities.AppSettings.create(payload);
        setExistingId(created.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[TelegramSettings] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');

    const { bot_token, chat_id } = settings;

    if (!bot_token || !chat_id) {
      setTestResult('error');
      setTestError('Bot Token and Chat ID are required before testing.');
      setTesting(false);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${bot_token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: 'RestoCTRL Telegram integration successful.',
          parse_mode: 'HTML',
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setTestError(data.description || 'Telegram API returned an error.');
      }
    } catch (err) {
      setTestResult('error');
      setTestError(err.message || 'Network error — could not reach Telegram API.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Telegram Notifications"
        subtitle="Receive real-time alerts in Telegram when key events occur."
      />

      {/* Setup Instructions */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <Info className="w-4 h-4" />
            How to set up your Telegram Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p>1. Open Telegram and search for <strong>@BotFather</strong>.</p>
          <p>2. Send <code>/newbot</code> and follow the prompts to create your bot.</p>
          <p>3. Copy the <strong>HTTP API Token</strong> provided by BotFather and paste it below.</p>
          <p>4. Start a conversation with your new bot (send it any message).</p>
          <p>5. Visit <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> to find your <strong>Chat ID</strong> (the <code>id</code> inside <code>chat</code>).</p>
          <p>6. Paste your Chat ID below, save, then press <strong>Send Test Message</strong>.</p>
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-5 h-5 text-blue-600" />
            Bot Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Telegram Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, events will be sent to your Telegram chat.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings(s => ({ ...s, enabled: v }))}
            />
          </div>

          {/* Bot Token */}
          <div className="space-y-1.5">
            <Label htmlFor="bot_token">Bot Token</Label>
            <Input
              id="bot_token"
              type="password"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={settings.bot_token}
              onChange={(e) => setSettings(s => ({ ...s, bot_token: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Provided by @BotFather when you create a bot.</p>
          </div>

          {/* Chat ID */}
          <div className="space-y-1.5">
            <Label htmlFor="chat_id">Chat ID</Label>
            <Input
              id="chat_id"
              type="text"
              placeholder="e.g. 123456789 or -100123456789"
              value={settings.chat_id}
              onChange={(e) => setSettings(s => ({ ...s, chat_id: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Your personal or group chat ID. Negative IDs are for groups.</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-[120px]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : saved ? (
                <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Saved!</>
              ) : (
                'Save Settings'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !settings.bot_token || !settings.chat_id}
              className="min-w-[160px]"
            >
              {testing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Test Message</>
              )}
            </Button>
          </div>

          {/* Test Result */}
          {testResult === 'success' && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Test message sent successfully.</strong> Check your Telegram chat for the message.
              </span>
            </div>
          )}

          {testResult === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-300">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Test failed.</strong> {testError}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Integration status</span>
            {settings.enabled && settings.bot_token && settings.chat_id ? (
              <Badge variant="outline" className="text-green-600 border-green-400">
                <CheckCircle className="w-3 h-3 mr-1" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                Not configured
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Notifications</span>
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
