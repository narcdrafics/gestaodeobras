"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const profileRef = ref(db, `profiles/${firebaseUser.uid}`);
          const profileSnap = await get(profileRef);
          const profileData = profileSnap.val();

          if (profileData && profileData.tenantId) {
             setUser({
               uid: firebaseUser.uid,
               email: firebaseUser.email || "",
               name: profileData.name || firebaseUser.displayName || "",
               role: profileData.role || "admin",
               tenantId: profileData.tenantId,
             });
          } else {
             // Caso não tenha perfil criado ou seja o primeiro login
             console.warn("Usuário autenticado, mas perfil(tenant) ausente no banco.");
             setUser(null);
          }
        } catch (error) {
           console.error("Erro ao buscar perfil do usuário", error);
           setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
