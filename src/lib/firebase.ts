import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD9i1vMwmJwiUfwUKetxrzIO6Bm5K-5oro",
  authDomain: "controle-obras-c889d.firebaseapp.com",
  databaseURL: "https://controle-obras-c889d-default-rtdb.firebaseio.com",
  projectId: "controle-obras-c889d",
  storageBucket: "controle-obras-c889d.firebasestorage.app",
  messagingSenderId: "570296468947",
  appId: "1:570296468947:web:fff3403f8fbb72225d1b26",
  measurementId: "G-KVPEMVBXTY"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
