'use client';

// WhatsApp-style swipe gesture hook for swipe-to-reply
import { useRef, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number; // minimum distance to trigger swipe (default 60px)
  maxVerticalMovement?: number; // cancel if vertical movement exceeds this (default 30px)
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
}

export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const {
    onSwipeRight,
    onSwipeLeft,
    threshold = 60,
    maxVerticalMovement = 30,
  } = options;

  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    isDragging: false,
  });

  const elementRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      isDragging: true,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!stateRef.current.isDragging) return;

      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - stateRef.current.startY);

      // Cancel if vertical movement is too much (user is scrolling)
      if (deltaY > maxVerticalMovement) {
        stateRef.current.isDragging = false;
        if (elementRef.current) {
          elementRef.current.style.transform = '';
          elementRef.current.style.transition = 'transform 0.2s ease-out';
        }
        return;
      }

      const deltaX = touch.clientX - stateRef.current.startX;
      stateRef.current.currentX = touch.clientX;

      // Only allow right swipe (for reply) - limit to threshold * 1.5
      if (deltaX > 0 && elementRef.current) {
        const clampedDelta = Math.min(deltaX, threshold * 1.5);
        elementRef.current.style.transform = `translateX(${clampedDelta}px)`;
        elementRef.current.style.transition = 'none';
      }
    },
    [maxVerticalMovement, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (!stateRef.current.isDragging) return;

    const deltaX = stateRef.current.currentX - stateRef.current.startX;
    stateRef.current.isDragging = false;

    // Reset transform with animation
    if (elementRef.current) {
      elementRef.current.style.transform = '';
      elementRef.current.style.transition = 'transform 0.2s ease-out';
    }

    // Check if swipe threshold was met
    if (deltaX >= threshold && onSwipeRight) {
      onSwipeRight();
    } else if (deltaX <= -threshold && onSwipeLeft) {
      onSwipeLeft();
    }
  }, [threshold, onSwipeRight, onSwipeLeft]);

  const getSwipeOffset = useCallback(() => {
    if (!stateRef.current.isDragging) return 0;
    return Math.max(0, stateRef.current.currentX - stateRef.current.startX);
  }, []);

  return {
    ref: elementRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    getSwipeOffset,
  };
}
