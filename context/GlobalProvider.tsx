// context/GlobalProvider.tsx
import { getCurrentUser } from "../lib/auth";
// 🔥 Global reference for outside-React access
let globalContextRef: any = null;
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  $id?: number;
  username: string;
  email: string;
  usercode: string;
  phone?: string;
  email2?: string;
  manager?: string;
  discount?: number;
  active?: boolean;
  action?: boolean;
  discount2?: number;
  action2?: boolean;
}

interface GlobalContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const GlobalContext = createContext<GlobalContextType>({} as GlobalContextType);

export const useGlobalContext = () => useContext(GlobalContext);

interface Props {
  children?: ReactNode;
}

export const GlobalProvider = ({ children }: Props) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔥 store context globally so lib/trade.ts can read/update user safely
  globalContextRef = {
    isLoggedIn, setIsLoggedIn, user, setUser, isLoading, setIsLoading,
  };

  return (
    <GlobalContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        user,
        setUser,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

// 🔥 Allows non-component code (API wrappers, trade fetcher) to access context safely
export const getGlobalContext = () => {
  return globalContextRef;
};

export default GlobalProvider;