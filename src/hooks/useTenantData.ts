"use client";

import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/contexts/AuthContext";

export interface TenantData {
  config: any;
  obras: any[];
  tarefas: any[];
  financeiro: any[];
  presenca: any[];
  medicao: any[];
  compras: any[];
  estoque: any[];
  requisicoes: any[];
  ferramental: any[];
  trabalhadores: any[];
}

const emptyData: TenantData = {
  config: {}, obras: [], tarefas: [], financeiro: [],
  presenca: [], medicao: [], compras: [], estoque: [], 
  requisicoes: [], ferramental: [], trabalhadores: []
};

export function useTenantData() {
  const { user } = useAuth();
  const [data, setData] = useState<TenantData>(emptyData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.tenantId) {
      setData(emptyData);
      setLoading(false);
      return;
    }

    const tenantRef = ref(db, `tenants/${user.tenantId}`);
    
    const unsubscribe = onValue(tenantRef, (snapshot) => {
      const val = snapshot.val() || {};
      
      // Sanitização básica similar ao `ensureSchema` legado
      setData({
        config: val.config || {},
        obras: Array.isArray(val.obras) ? val.obras : [],
        tarefas: Array.isArray(val.tarefas) ? val.tarefas : [],
        financeiro: Array.isArray(val.financeiro) ? val.financeiro : [],
        presenca: Array.isArray(val.presenca) ? val.presenca : [],
        medicao: Array.isArray(val.medicao) ? val.medicao : [],
        compras: Array.isArray(val.compras) ? val.compras : [],
        estoque: Array.isArray(val.estoque) ? val.estoque : [],
        requisicoes: Array.isArray(val.requisicoes) ? val.requisicoes : [],
        ferramental: Array.isArray(val.ferramental) ? val.ferramental : [],
        trabalhadores: Array.isArray(val.trabalhadores) ? val.trabalhadores : [],
      });
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar dados do tenant:", error);
      setLoading(false);
    });

    return () => {
      off(tenantRef, "value", unsubscribe);
    };
  }, [user]);

  return { data, loading };
}
