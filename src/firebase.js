import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1X7lkIYmZlEtx7NEAAhsR7fCReRGe5HU",
  authDomain: "fantapannolino-40370.firebaseapp.com",
  projectId: "fantapannolino-40370",
  storageBucket: "fantapannolino-40370.firebasestorage.app",
  messagingSenderId: "1056166776751",
  appId: "1:1056166776751:web:09ddcb1f5fbd5613ca295a"
};

export const isFirebaseConfigured = () => true;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
