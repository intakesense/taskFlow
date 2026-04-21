'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@taskflow/ui';
import { LogIn, LogOut, Loader2, Clock, Link2 } from 'lucide-react';
import { CheckoutDialog } from './checkout-dialog';
import { NavigationLink } from '../primitives/navigation-link';

export interface AttendanceStatus {
  linked: boolean;
  tokenExpired?: boolean;
  employee?: { name: string; employeeId: string };
  attendance?: {
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    workHours?: number;
  } | null;
}

async function requestLocation(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 5000, maximumAge: 30_000 }
    );
  });
}


function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);

  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch('/api/hrms/attendance');
      if (res.ok) {
        const { attendance } = await res.json();
        setStatus(prev => prev ? { ...prev, attendance } : null);
      }
    } catch { /* silent */ } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/hrms/status');
      if (res.ok) {
        const data = await res.json();
        if (data.linked && !data.tokenExpired) {
          // Set loadingAttendance before clearing loadingStatus to avoid a render
          // where both are false and attendance is still unknown.
          setLoadingAttendance(true);
        }
        setStatus(data);
        if (data.linked && !data.tokenExpired) {
          fetchAttendance();
        }
      }
    } catch { /* silent */ } finally {
      setLoadingStatus(false);
    }
  }, [fetchAttendance]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const coords = await requestLocation();
      const body: Record<string, unknown> = {};
      if (coords) {
        body.latitude = coords.latitude;
        body.longitude = coords.longitude;
        body.accuracy = coords.accuracy;
      }
      const res = await fetch('/api/hrms/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Check-in failed'); return; }
      toast.success('Checked in!');
      await fetchAttendance();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="mx-3 mb-3">
        <div className="h-9 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!status?.linked || status.tokenExpired) {
    return (
      <div className="mx-3 mb-3">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavigationLink
                href="/settings#hrms"
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                {status?.tokenExpired ? 'Re-link HRMS' : 'Link HRMS'}
              </NavigationLink>
            </TooltipTrigger>
            <TooltipContent side="right">
              {status?.tokenExpired
                ? 'Session expired — go to Settings to re-link'
                : 'Connect your HRMS account in Settings'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  const isCheckedIn = status.attendance?.checkIn && !status.attendance?.checkOut;
  const isCheckedOut = status.attendance?.checkIn && status.attendance?.checkOut;

  return (
    <div className="mx-3 mb-3 space-y-1.5">
      {loadingAttendance ? (
        <div className="h-4 rounded bg-muted animate-pulse mx-1" />
      ) : (isCheckedIn || isCheckedOut) && (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(status.attendance?.checkIn)}
            {isCheckedOut && ` – ${formatTime(status.attendance?.checkOut)}`}
          </span>
          {isCheckedOut && status.attendance?.workHours != null
            ? <span className="font-medium text-foreground">{status.attendance.workHours.toFixed(1)}h</span>
            : isCheckedIn && <span className="text-green-500 font-medium">Active</span>
          }
        </div>
      )}

      {isCheckedOut ? (
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs text-muted-foreground" disabled>
          <LogOut className="w-3.5 h-3.5" />
          Done for today
        </Button>
      ) : isCheckedIn ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
            onClick={() => setCheckoutDialogOpen(true)}
          >
            <LogOut className="w-3.5 h-3.5" />
            Check Out
          </Button>
          <CheckoutDialog
            open={checkoutDialogOpen}
            onOpenChange={setCheckoutDialogOpen}
            onCheckedOut={fetchAttendance}
            getLocation={requestLocation}
          />
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs border-green-500/40 text-green-500 hover:bg-green-500/10"
          onClick={handleCheckIn}
          disabled={checkingIn || loadingAttendance}
        >
          {checkingIn
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <LogIn className="w-3.5 h-3.5" />
          }
          {checkingIn ? 'Checking in...' : 'Check In'}
        </Button>
      )}
    </div>
  );
}
