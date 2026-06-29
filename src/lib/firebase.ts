import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCaf1FHg56-HIa-39FkPEY3146guGiZCX8",
  authDomain: "leadroom-auth.firebaseapp.com",
  projectId: "leadroom-auth",
  storageBucket: "leadroom-auth.firebasestorage.app",
  messagingSenderId: "511277631424",
  appId: "1:511277631424:web:ca3d4dff1e2af69bc6ea25",
  measurementId: "G-PGWEBF0K0V"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
