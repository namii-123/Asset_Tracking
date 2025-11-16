// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 

//Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBauK_4tqQOiRJUstFbFuEEk1zcDO72FII",
  authDomain: "ppgloginsystem-298a9.firebaseapp.com",
  projectId: "ppgloginsystem-298a9",
  storageBucket: "ppgloginsystem-298a9.firebasestorage.app",
  messagingSenderId: "849262140961",
  appId: "1:849262140961:web:4be829946c48da9f0b4d60",
  measurementId: "G-GWGMHPX7T5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const db = getFirestore(app);
export const storage = getStorage(app); 
export { auth, provider };
export default app;
