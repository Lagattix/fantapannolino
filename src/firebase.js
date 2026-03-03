import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA1X7lkIYmZlEtx7NEAAhsR7fCReRGe5HU",
  authDomain: "fantapannolino-40370.firebaseapp.com",
  projectId: "fantapannolino-40370",
  storageBucket: "fantapannolino-40370.firebasestorage.app",
  messagingSenderId: "1056166776751",
  appId: "1:1056166776751:web:09ddcb1f5fbd5613ca295a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
