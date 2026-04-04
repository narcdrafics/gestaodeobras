"use client";

import { ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/contexts/AuthContext";
import { message } from "antd";

export function useFirebaseMutations() {
  const { user } = useAuth();

  /**
   * Universal save for arrays. Supports creating and updating.
   * @param node The DB node (e.g., 'obras', 'tarefas')
   * @param data The object to be saved
   * @param existingIdx The index in the array to update. Pass -1 or omit to push as new.
   */
  const saveItem = async (node: string, data: any, existingIdx: number = -1) => {
    if (!user?.tenantId) {
      message.error("Usuário não autenticado ou sem tenant associado.");
      return false;
    }

    try {
      const nodeRef = ref(db, `tenants/${user.tenantId}/${node}`);
      const snapshot = await get(nodeRef);
      let currentArray = snapshot.val() || [];
      
      // Ensure it is an array
      if (!Array.isArray(currentArray)) {
         currentArray = Object.values(currentArray);
      }

      if (existingIdx >= 0 && existingIdx < currentArray.length) {
        currentArray[existingIdx] = data; // Update
      } else {
        currentArray.push(data); // Create
      }

      await set(nodeRef, currentArray);
      return true;
    } catch (error) {
      console.error(`Error saving item to ${node}:`, error);
      message.error("Falha ao salvar no banco de dados.");
      return false;
    }
  };

  /**
   * Plural version of saveItem. Efficiently saves multiple items in one go.
   * @param node The DB node
   * @param items Array of data objects
   */
  const saveItems = async (node: string, items: any[]) => {
    if (!user?.tenantId) return false;
    if (!items.length) return true;

    try {
      const nodeRef = ref(db, `tenants/${user.tenantId}/${node}`);
      const snapshot = await get(nodeRef);
      let currentArray = snapshot.val() || [];
      
      if (!Array.isArray(currentArray)) {
         currentArray = Object.values(currentArray);
      }

      const newArray = [...currentArray, ...items];
      await set(nodeRef, newArray);
      return true;
    } catch (error) {
      console.error(`Error saving multiple items to ${node}:`, error);
      message.error("Falha ao salvar múltiplos registros.");
      return false;
    }
  };

  /**
   * Universal deletion from arrays.
   * @param node The DB node
   * @param index The array index to remove
   */
  const deleteItem = async (node: string, index: number) => {
     if (!user?.tenantId) return false;

     try {
       const nodeRef = ref(db, `tenants/${user.tenantId}/${node}`);
       const snapshot = await get(nodeRef);
       let currentArray = snapshot.val() || [];

       if (Array.isArray(currentArray)) {
         currentArray.splice(index, 1);
         await set(nodeRef, currentArray);
         message.success("Registro removido com sucesso!");
         return true;
       }
       return false;
     } catch (error) {
        console.error(`Error deleting item from ${node}:`, error);
        message.error("Falha ao remover o registro.");
        return false;
     }
  };

  return { saveItem, saveItems, deleteItem };
}
