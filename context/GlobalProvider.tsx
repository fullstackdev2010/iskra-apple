// context/GlobalProvider.tsx
import { getCurrentUser } from "../lib/auth";
// 🔥 Global reference for outside-React access
let globalContextRef: any = null;
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
}

// In-memory guest flag, controlled by landing / auth screens
let guestSession = false;
export const setGuestSession = (v: boolean) => {
  guestSession = v;
};

const GlobalContext = createContext<GlobalContextType>({} as GlobalContextType);

export const useGlobalContext = () => useContext(GlobalContext);

interface Props {
  children?: ReactNode;
}

export const GlobalProvider = ({ children }: Props) => {
  const [isLoggedInState, _setIsLoggedIn] = useState(false);
  const [userState, _setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Wrapped setters enforcing guest mode
  const setIsLoggedIn = (loggedIn: boolean) => {
    if (guestSession) {
      _setIsLoggedIn(false);
      return;
    }
    _setIsLoggedIn(loggedIn);
  };

  const setUser = (user: User | null) => {
    if (guestSession) {
      _setUser({
        username: "Новый Пользователь",
        email: "",
        usercode: "",
      });
      return;
    }
    _setUser(user);
  };

  // On mount, initialize guestSession from storage
  useEffect(() => {
    (async () => {
      try {
        const g = await AsyncStorage.getItem("guest_mode");
        if (g === "1") {
          guestSession = true;
          _setIsLoggedIn(false);
          _setUser({
            username: "Новый Пользователь",
            email: "",
            usercode: "",
          });
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 🔥 store context globally so lib/trade.ts can read/update user safely
  globalContextRef = {
    isLoggedIn: isLoggedInState,
    setIsLoggedIn,
    user: userState,
    setUser,
    isLoading,
    setIsLoading,
    hydrated,
    setHydrated,
  };

  return (
    <GlobalContext.Provider
      value={{
        isLoggedIn: isLoggedInState,
        setIsLoggedIn,
        user: userState,
        setUser,
        isLoading,
        setIsLoading,
        hydrated,
        setHydrated,
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
