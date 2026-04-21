'use client';

/**
 * AttachMenu — attachment source picker triggered by the Paperclip button.
 *
 * Uses shadcn DropdownMenu so we get keyboard nav, focus management,
 * aria roles, and animation for free. No custom popover nonsense.
 *
 * Sources:
 *   - From Device  → native file input (existing behaviour)
 *   - Google Drive → Drive Picker via useDrivePicker hook
 */

import { useRef } from 'react';
import { Paperclip, FolderOpen, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@taskflow/ui';
import { useDrivePicker, type DriveFile } from './drive-picker';

interface AttachMenuProps {
    disabled?: boolean
    /** Called when user picks a local file from their device */
    onFileSelected: (file: File) => void
    /** Called when user picks a file from Google Drive */
    onDriveFileSelected: (file: DriveFile) => void
    /** Forwarded to the hidden file input */
    accept?: string
}

export function AttachMenu({
    disabled,
    onFileSelected,
    onDriveFileSelected,
    accept,
}: AttachMenuProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { openPicker } = useDrivePicker({
        onFilePicked: onDriveFileSelected,
        onError: (err) => toast.error(err),
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) onFileSelected(file)
        // Reset so the same file can be selected again
        e.target.value = ''
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Attach file"
                        disabled={disabled}
                        className="h-9 w-9 sm:h-11 sm:w-11 rounded-full touch-manipulation flex-shrink-0"
                    >
                        <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Attach file</span>
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="top" align="start" className="w-44">
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        Attach from
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                        <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                        From Device
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={openPicker}>
                        <HardDrive className="h-4 w-4 mr-2 text-muted-foreground" />
                        Google Drive
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
