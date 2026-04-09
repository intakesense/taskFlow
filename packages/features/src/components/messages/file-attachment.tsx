'use client';

import { useState, useMemo, type ReactNode } from 'react';
import {
  File,
  FileText,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Download,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@taskflow/ui';
import { OptimizedImage } from '../../providers/image-context';

// File icon mapping - declared outside component to avoid recreation
const FILE_ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  pdf: FileText,
  video: FileVideo,
  audio: FileAudio,
  default: File,
};

function getFileIconType(fileType: string): keyof typeof FILE_ICONS {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType === 'application/pdf') return 'pdf';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  return 'default';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  className?: string;
  /** Render prop for the preview modal - allows parent to provide platform-specific modal */
  renderPreviewModal?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileUrl: string;
    fileName: string;
    fileType: string;
  }) => ReactNode;
}

export function FileAttachment({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  className,
  renderPreviewModal,
}: FileAttachmentProps) {
  const [showPreview, setShowPreview] = useState(false);

  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf';
  const isVideo = fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');

  const FileIcon = useMemo(() => FILE_ICONS[getFileIconType(fileType)], [fileType]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  const previewModal = renderPreviewModal?.({
    open: showPreview,
    onOpenChange: setShowPreview,
    fileUrl,
    fileName,
    fileType,
  });

  // Image thumbnail
  if (isImage) {
    return (
      <>
        <div
          onClick={() => setShowPreview(true)}
          className={cn(
            'relative group cursor-pointer rounded-lg overflow-hidden max-w-full sm:max-w-sm',
            className
          )}
        >
          <OptimizedImage
            src={fileUrl}
            alt={fileName}
            width={400}
            height={256}
            className="w-full h-auto max-h-64 object-cover rounded-lg"
          />
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-white" />
          </div>
          {/* File info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-xs text-white truncate">{fileName}</p>
            {fileSize && <p className="text-xs text-white/70">{formatFileSize(fileSize)}</p>}
          </div>
        </div>

        {previewModal}
      </>
    );
  }

  // Video thumbnail
  if (isVideo) {
    return (
      <>
        <div
          onClick={() => setShowPreview(true)}
          className={cn(
            'relative group cursor-pointer rounded-lg overflow-hidden max-w-full sm:max-w-sm',
            className
          )}
        >
          <video src={fileUrl} className="w-full h-auto max-h-64 object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <FileVideo className="h-8 w-8 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-xs text-white truncate">{fileName}</p>
            {fileSize && <p className="text-xs text-white/70">{formatFileSize(fileSize)}</p>}
          </div>
        </div>

        {previewModal}
      </>
    );
  }

  // File card for PDFs and other files
  return (
    <>
      <div
        onClick={() => setShowPreview(true)}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer max-w-full sm:max-w-sm',
          className
        )}
      >
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>}
        </div>
        <button
          onClick={handleDownload}
          className="flex-shrink-0 p-2 rounded-md hover:bg-background transition-colors"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {(isPDF || isAudio) && previewModal}
    </>
  );
}
