import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAhuPqgZewzLJr6IZubJTfK6DbQFUGgX-M",
  authDomain: "farming-e230b.firebaseapp.com",
  databaseURL: "https://farming-e230b-default-rtdb.firebaseio.com",
  projectId: "farming-e230b",
  storageBucket: "farming-e230b.firebasestorage.app",
  messagingSenderId: "298027833700",
  appId: "1:298027833700:web:8b58eb46f37b6ddaa78271"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, child };