import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBk7O12fmrKJ72B0c97e1yun04iBVtaoF0",
  authDomain: "alert-quarter-f40ks.firebaseapp.com",
  projectId: "alert-quarter-f40ks",
  storageBucket: "alert-quarter-f40ks.firebasestorage.app",
  messagingSenderId: "86053346745",
  appId: "1:86053346745:web:3ff3fd9b98a82749996a68"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-505fa223-f3e7-4a1a-a650-d33162a50704");
