'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface BottomNavContextType {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const BottomNavContext = createContext<BottomNavContextType>({
  visible: true,
  setVisible: () => {},
});

export function BottomNavProvider({ children }: { children: ReactNode }) {
  const [visible, setVisibleState] = useState(true);

  const setVisible = useCallback((value: boolean) => {
    setVisibleState(value);
  }, []);

  return (
    <BottomNavContext.Provider value={{ visible, setVisible }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNavVisibility() {
  return useContext(BottomNavContext);
}
