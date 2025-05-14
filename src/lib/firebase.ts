
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDaphZpBgJnKK74eirmP3becW5CIy8jtRs",
  authDomain: "chatsimulation.firebaseapp.com",
  projectId: "chatsimulation",
  storageBucket: "chatsimulation.appspot.com", // Korrigiert: .appspot.com ist üblich
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

// Optional: Analytics können später hinzugefügt werden, wenn benötigt
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

export { app, db };
