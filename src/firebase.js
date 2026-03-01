import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Sostituisci questo oggetto con la tua configurazione Firebase!
// Puoi ottenerla creando un progetto su https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "IL_TUO_API_KEY",
  authDomain: "IL_TUO_APP.firebaseapp.com",
  projectId: "IL_TUO_PROJECT_ID",
  storageBucket: "IL_TUO_APP.appspot.com",
  messagingSenderId: "IL_TUO_SENDER_ID",
  appId: "IL_TUO_APP_ID"
};

let app;
let db;

// Funzione helper per verificare se Firebase è configurato
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "IL_TUO_API_KEY";
};

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.error("Errore nell'inizializzazione di Firebase:", error);
  }
} else {
  console.warn("Firebase non è configurato. L'app funzionerà in modalità DEMO locale.");
}

export { db };
