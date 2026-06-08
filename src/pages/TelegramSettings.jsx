import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/shared/PageHeader';
import { Send, Bot, CheckCircle, XCircle, Loader2, Info, MessageSquare } from 'lucide-react';

const SETTING_KEY = 'telegram_notification_settings';

const DEFAULT_TEMPLATE = `Restaurant: {restaurant}
Branch: {branch}
Event: {event}
Amount: {amount}
Time: {time}`;

const DEFAULT_SETTINGS = {
  enabled: false,
  bot_token: '',
  chat_id: '',
  message_template: DEFAULT_TEMPLATE,
};

export default function TelegramSettings() {
  const { user } = useAuth();
  const { orgId, activeRestaurantId } = useTenant();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // null | 'success' | 'error'
  const [testError, setTestError] = useState('');

  // Load existing settings from app_settings
  // REQUIRED: Filter by setting key, org_id, and restaurant_id
  useEffect(() => {
    if (!user?.email || !orgId || !activeRestaurantId) return;
    
    base44.entities.AppSettings.filter({ 
      key: SETTING_KEY, 
      org_id: orgId,
      restaurant_id: activeRestaurantId 
    }, '-created_date', 1)
      .then(rows => {
        if (rows[0]?.value) {
          try {
            const parsed = JSON.parse(rows[0].value);
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            setExistingId(rows[0].id);
          } catch {
            // malformed JSON — use defaults
          }
        } else {
          // Reset to defaults if no settings found for this restaurant
          setSettings(DEFAULT_SETTINGS);
          setExistingId(null);
        }
      })
      .catch(err => console.warn('[TelegramSettings] load error:', err));
  }, [user?.email, orgId, activeRestaurantId]);

  const handleSave = async () => {
    console.log('[TelegramSettings] handleSave triggered', { hasUser: !!user?.email, orgId, activeRestaurantId });
    if (!user?.email || !orgId || !activeRestaurantId) {
      console.warn('[TelegramSettings] Save blocked: missing context', { user: !!user?.email, orgId, activeRestaurantId });
      return;
    }
    setSaving(true);

    const payload = {
      key: SETTING_KEY,
      value: JSON.stringify(settings),
      org_id: orgId,
      restaurant_id: activeRestaurantId
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

    const { bot_token, chat_id, message_template } = settings;

    if (!bot_token || !chat_id) {
      setTestResult('error');
      setTestError('Bot Token and Chat ID are required before testing.');
      setTesting(false);
      return;
    }

    try {
      const testMessage = message_template
        .replace('{restaurant}', 'Test Restaurant')
        .replace('{branch}', 'Main Branch')
        .replace('{event}', 'Test Notification')
        .replace('{amount}', '0.00')
        .replace('{time}', new Date().toLocaleTimeString());

      const url = `https://api.telegram.org/bot${bot_token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          text: testMessage,
          parse_mode: 'HTML'
        })
      });

      const data = await response.json();
      if (data.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setTestError(data.description || 'Failed to send message.');
      }
    } catch (err) {
      setTestResult('error');
      setTestError('Network error or invalid Bot Token.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <PageHeader 
        title="Telegram Notifications" 
        subtitle="Configure your bot to receive real-time alerts for restaurant events."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bot Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="w-5 h-5 text-blue-600" />
              Bot Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Telegram Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, events will be sent to your Telegram chat.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bot_token">Bot Token</Label>
              <Input
                id="bot_token"
                type="password"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={settings.bot_token}
                onChange={(e) => setSettings(s => ({ ...s, bot_token: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Provided by @BotFather when you create a bot.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat_id">Chat ID</Label>
              <Input
                id="chat_id"
                placeholder="e.g. 123456789 or -100123456789"
                value={settings.chat_id}
                onChange={(e) => setSettings(s => ({ ...s, chat_id: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Your personal or group chat ID. Negative IDs are for groups.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
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

        {/* Message Template Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Message Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template">Template Content</Label>
              <Textarea
                id="template"
                placeholder="Enter your message template..."
                className="min-h-[150px] font-mono text-sm"
                value={settings.message_template}
                onChange={(e) => setSettings(s => ({ ...s, message_template: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {['{restaurant}', '{branch}', '{event}', '{amount}', '{time}'].map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-secondary/80"
                    onClick={() => {
                      const el = document.getElementById('template');
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      const text = settings.message_template;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      setSettings(s => ({ ...s, message_template: before + tag + after }));
                      // Focus back after state update
                      setTimeout(() => {
                        el.focus();
                        el.setSelectionRange(start + tag.length, start + tag.length);
                      }, 0);
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted p-3">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" /> Preview
              </h4>
              <div className="text-xs whitespace-pre-wrap font-mono">
                {settings.message_template
                  .replace('{restaurant}', 'My Restaurant')
                  .replace('{branch}', 'Main')
                  .replace('{event}', 'New Order')
                  .replace('{amount}', '150.00')
                  .replace('{time}', '12:30 PM')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
