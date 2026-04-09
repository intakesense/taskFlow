'use client'

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { useVoiceParticipants } from '@/hooks/use-voice-participants'
import { voiceChannelService } from '@/lib/services/voice-channels'
import { DashboardLayout } from '@/components/layout'

// Dynamic import to avoid SSR issues with @openai/agents -> @modelcontextprotocol/sdk -> zod
const VoiceChannelPanel = dynamic(
  () => import('./voice-channel-panel').then(mod => mod.VoiceChannelPanel),
  { ssr: false }
)
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Headphones, Mic, Video, Users, Loader2, Monitor } from 'lucide-react'

export function ChitChatContainer() {
  const { isConnected, isConnecting, joinChannel } = useVoiceChannel()

  const { data: defaultChannel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['voice-channel', 'default'],
    queryFn: () => voiceChannelService.getDefaultChannel(),
  })

  const { participants } = useVoiceParticipants(defaultChannel?.id || null)

  if (isLoadingChannel) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!defaultChannel) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">No voice channel available</p>
        </div>
      </DashboardLayout>
    )
  }

  if (isConnected || isConnecting) {
    return (
      <DashboardLayout>
        <VoiceChannelPanel className="h-screen" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{defaultChannel.name}</CardTitle>
            <CardDescription>{defaultChannel.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {participants.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Currently in channel</span>
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {participants.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {participants.slice(0, 6).map((p) => (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-2 px-2 py-1 bg-muted rounded-full"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={p.user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {p.user.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{p.user.name}</span>
                      {!p.is_muted && (
                        <Mic className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  ))}
                  {participants.length > 6 && (
                    <div className="flex items-center px-2 py-1 bg-muted rounded-full">
                      <span className="text-sm text-muted-foreground">
                        +{participants.length - 6} more
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p>No one is here yet. Be the first to join!</p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => joinChannel(defaultChannel)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Headphones className="h-4 w-4" />
                  Join Voice Channel
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                <span>Voice</span>
              </div>
              <div className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                <span>Video</span>
              </div>
              <div className="flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                <span>Screen Share</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
