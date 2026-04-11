"use client"



import { useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, FileText, Image as ImageIcon, LucideIcon } from 'lucide-react'
import { cn } from './lib/utils'
import { Button } from './button'

// File icon mapping - declared outside component to avoid recreation during render
const FILE_ICON_MAP: Record<string, LucideIcon> = {
  image: ImageIcon,
  text: FileText,
  default: File,
}

function getFileIconKey(type: string): string {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('text/')) return 'text'
  return 'default'
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  maxSize?: number // in bytes
  accept?: Record<string, string[]>
  multiple?: boolean
  className?: string
}

export function FileUpload({
  onFilesSelected,
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept,
  multiple = true,
  className,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesSelected(acceptedFiles)
    },
    [onFilesSelected]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    maxSize,
    accept,
    multiple,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
        isDragActive && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-muted-foreground/50',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <Upload className={cn(
          'h-8 w-8',
          isDragActive ? 'text-primary' : 'text-muted-foreground'
        )} />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">Drop files here</p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Max file size: {(maxSize / (1024 * 1024)).toFixed(0)}MB
            </p>
          </>
        )}
        {fileRejections.length > 0 && (
          <p className="text-xs text-destructive">
            Some files were rejected. Please check file size and type.
          </p>
        )}
      </div>
    </div>
  )
}

interface FilePreviewProps {
  file: File
  onRemove: () => void
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const FileIcon = useMemo(() => FILE_ICON_MAP[getFileIconKey(file.type)], [file.type])

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
      <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
