"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyBalance, topUpBalance } from "./db";

interface WalletContextValue {
  balance: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  topUp: (amount: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0);
      return;
    }
    setIsLoading(true);
    try {
      setBalance(await getMyBalance());
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const topUp = useCallback(async (amount: number) => {
    const next = await topUpBalance(amount);
    setBalance(next);
  }, []);

  return (
    <WalletContext.Provider value={{ balance, isLoading, refresh, topUp }}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
