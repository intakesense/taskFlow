'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout'
import { useAuth } from '@/lib/auth-context'
import { useThemeContext } from '@/components/providers/theme-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Settings, Moon, Sun, Monitor, Palette, User, Loader2 } from 'lucide-react'
import { ThemeMode, ThemePreset } from '@/lib/theme/types'

export default function SettingsPage() {
    const { profile } = useAuth()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8 flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    return <SettingsContent profile={profile} />
}

function SettingsContent({ profile }: { profile: { name?: string; email?: string } | null }) {
    const { mode, preset, setMode, setPreset } = useThemeContext()

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                            <Settings className="h-8 w-8" />
                            Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Customize your TaskFlow experience
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Profile Card */}
                        <Card data-slot="card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Profile
                                </CardTitle>
                                <CardDescription>Your account information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                                        {profile?.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold">{profile?.name}</p>
                                        <p className="text-muted-foreground">{profile?.email}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Appearance Card */}
                        <Card data-slot="card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Palette className="h-5 w-5" />
                                    Appearance
                                </CardTitle>
                                <CardDescription>Customize the look and feel</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Theme Mode */}
                                <div className="space-y-2">
                                    <Label>Theme Mode</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={mode === 'light' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setMode('light')}
                                            className="flex-1"
                                        >
                                            <Sun className="h-4 w-4 mr-2" />
                                            Light
                                        </Button>
                                        <Button
                                            variant={mode === 'dark' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setMode('dark')}
                                            className="flex-1"
                                        >
                                            <Moon className="h-4 w-4 mr-2" />
                                            Dark
                                        </Button>
                                        <Button
                                            variant={mode === 'system' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setMode('system')}
                                            className="flex-1"
                                        >
                                            <Monitor className="h-4 w-4 mr-2" />
                                            System
                                        </Button>
                                    </div>
                                </div>

                                {/* Theme Preset */}
                                <div className="space-y-2">
                                    <Label>Theme Style</Label>
                                    <Select value={preset} onValueChange={(v) => setPreset(v as ThemePreset)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="modern">Modern (Default)</SelectItem>
                                            <SelectItem value="glass">Glassmorphism</SelectItem>
                                            <SelectItem value="neumorphism">Neumorphism</SelectItem>
                                            <SelectItem value="y2k">Y2K / Retro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Choose a visual style that suits your preference
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
