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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { useBreakpoints } from '@/hooks/use-mobile'

interface DeviceSettingsDialogProps {
  trigger?: React.ReactNode
}

function DeviceSettingsContent() {
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
  )
}

export function DeviceSettingsDialog({ trigger }: DeviceSettingsDialogProps) {
  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet

  const defaultTrigger = (
    <Button variant="outline" size="icon">
      <Settings className="h-4 w-4" />
    </Button>
  )

  // Use Sheet for mobile/tablet, Dialog for desktop
  if (isSmallScreen) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          {trigger || defaultTrigger}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Audio & Video Settings</SheetTitle>
            <SheetDescription>
              Select your preferred input and output devices
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            <DeviceSettingsContent />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audio & Video Settings</DialogTitle>
          <DialogDescription>
            Select your preferred input and output devices
          </DialogDescription>
        </DialogHeader>
        <DeviceSettingsContent />
      </DialogContent>
    </Dialog>
  )
}
