// context/GlobalProvider.tsx
import { getCurrentUser } from "../lib/auth";
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

  guestModeDefault: boolean;        // NEW
  setGuestModeDefault: (v: boolean) => void; // NEW
}

let guestSession = false;
export const setGuestSession = (v: boolean) => {
  guestSession = v;
};

const GlobalContext = createContext<GlobalContextType>({} as GlobalContextType);
export const useGlobalContext = () => useContext(GlobalContext);

export const GlobalProvider = ({ children }: { children?: ReactNode }) => {
  const [isLoggedInState, _setIsLoggedIn] = useState(false);
  const [userState, _setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // NEW — persistent guest default toggle controlled in ProfileCard
  const [guestModeDefault, setGuestModeDefault] = useState(true);

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

  // ---------------------------------------------------------
  // Hydrate guest mode and guest_default from AsyncStorage
  // ---------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const g = await AsyncStorage.getItem("guest_mode");
        const gd = await AsyncStorage.getItem("guest_default");

        if (gd === "0") setGuestModeDefault(false);
        if (gd === "1") setGuestModeDefault(true);

        if (g === "1") {
          guestSession = true;
          _setIsLoggedIn(false);
          _setUser({
            username: "Новый Пользователь",
            email: "",
            usercode: "",
          });
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  globalContextRef = {
    isLoggedIn: isLoggedInState,
    setIsLoggedIn,
    user: userState,
    setUser,
    isLoading,
    setIsLoading,
    hydrated,
    setHydrated,
    guestModeDefault,
    setGuestModeDefault,
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
        guestModeDefault,
        setGuestModeDefault,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const getGlobalContext = () => globalContextRef;
export default GlobalProvider;
