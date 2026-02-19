'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Loader2, Plus, X, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface BotConfig {
  name: string
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  isEnabled: boolean
  triggerPhrases: string[]
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Warm and conversational' },
  { value: 'fable', label: 'Fable', description: 'Expressive and animated' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'nova', label: 'Nova', description: 'Friendly and upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Clear and professional' },
] as const

export function AIBotSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newPhrase, setNewPhrase] = useState('')

  const [config, setConfig] = useState<BotConfig>({
    name: 'Bot',
    voice: 'alloy',
    isEnabled: true,
    triggerPhrases: ['Bot', 'Hey Bot'],
  })

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/ai/bot/config')
        if (res.ok) {
          const data = await res.json()
          setConfig({
            name: data.name,
            voice: data.voice,
            isEnabled: data.isEnabled,
            triggerPhrases: data.triggerPhrases,
          })
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  const addTriggerPhrase = () => {
    const phrase = newPhrase.trim()
    if (phrase && !config.triggerPhrases.includes(phrase)) {
      setConfig({
        ...config,
        triggerPhrases: [...config.triggerPhrases, phrase],
      })
      setNewPhrase('')
    }
  }

  const removeTriggerPhrase = (phrase: string) => {
    if (config.triggerPhrases.length > 1) {
      setConfig({
        ...config,
        triggerPhrases: config.triggerPhrases.filter((p) => p !== phrase),
      })
    } else {
      toast.error('At least one trigger phrase is required')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (res.ok) {
        toast.success('Bot settings saved')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error('Failed to save bot settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card data-slot="card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-slot="card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Bot
            </CardTitle>
            <CardDescription>
              Configure the AI secretary bot for voice channels
            </CardDescription>
          </div>
          <Switch
            checked={config.isEnabled}
            onCheckedChange={(checked) => setConfig({ ...config, isEnabled: checked })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot Name */}
        <div className="space-y-2">
          <Label htmlFor="botName">Name</Label>
          <Input
            id="botName"
            placeholder="Bot"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            disabled={!config.isEnabled}
          />
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Voice</Label>
          <Select
            value={config.voice}
            onValueChange={(value) => setConfig({ ...config, voice: value as BotConfig['voice'] })}
            disabled={!config.isEnabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((voice) => (
                <SelectItem key={voice.value} value={voice.value}>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    <span>{voice.label}</span>
                    <span className="text-muted-foreground text-xs">
                      - {voice.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Trigger Phrases */}
        <div className="space-y-2">
          <Label>Trigger Phrases</Label>
          <p className="text-xs text-muted-foreground">
            Bot responds when called by these phrases
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {config.triggerPhrases.map((phrase) => (
              <Badge
                key={phrase}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1"
              >
                {phrase}
                <button
                  type="button"
                  onClick={() => removeTriggerPhrase(phrase)}
                  className="ml-1 hover:text-destructive"
                  disabled={!config.isEnabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add phrase..."
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTriggerPhrase()
                }
              }}
              disabled={!config.isEnabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addTriggerPhrase}
              disabled={!config.isEnabled || !newPhrase.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Bot Settings
        </Button>
      </CardContent>
    </Card>
  )
}