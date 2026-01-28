'use client'

import { useDevices } from '@daily-co/daily-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Settings, Mic, Volume2, Video } from 'lucide-react'

interface DeviceSettingsDialogProps {
  trigger?: React.ReactNode
}

export function DeviceSettingsDialog({ trigger }: DeviceSettingsDialogProps) {
  const {
    microphones,
    speakers,
    cameras,
    setMicrophone,
    setSpeaker,
    setCamera,
    currentMic,
    currentSpeaker,
    currentCam,
  } = useDevices()

  const handleMicChange = (deviceId: string) => {
    setMicrophone(deviceId)
  }

  const handleSpeakerChange = (deviceId: string) => {
    setSpeaker(deviceId)
  }

  const handleCameraChange = (deviceId: string) => {
    setCamera(deviceId)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audio & Video Settings</DialogTitle>
          <DialogDescription>
            Select your preferred input and output devices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone
            </Label>
            <Select
              value={currentMic?.device?.deviceId || ''}
              onValueChange={handleMicChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {microphones.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Microphone ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Speaker
            </Label>
            <Select
              value={currentSpeaker?.device?.deviceId || ''}
              onValueChange={handleSpeakerChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select speaker" />
              </SelectTrigger>
              <SelectContent>
                {speakers.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Speaker ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Camera
            </Label>
            <Select
              value={currentCam?.device?.deviceId || ''}
              onValueChange={handleCameraChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Camera ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
