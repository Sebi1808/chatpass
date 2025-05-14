
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Added for Firebase Storage

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDaphZpBgJnKK74eirmP3becW5CIy8jtRs",
  authDomain: "chatsimulation.firebaseapp.com",
  projectId: "chatsimulation",
  storageBucket: "chatsimulation.appspot.com", 
  messagingSenderId: "334950741339",
  appId: "1:334950741339:web:7dc1f27f472d4abfe2d67e",
  measurementId: "G-446PZ79SFY"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const storage = getStorage(app); // Initialized Firebase Storage

export { app, db, storage }; // Export storage
