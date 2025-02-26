import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBUZnyBObbzN0RXv20g71K6-yN8v_niaMY",
  authDomain: "peoplecountproject-a7277.firebaseapp.com",
  databaseURL: "https://peoplecountproject-a7277-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "peoplecountproject-a7277",
  storageBucket: "peoplecountproject-a7277.firebasestorage.app",
  messagingSenderId: "584416421281",
  appId: "1:584416421281:android:4bb219102182bbf0fd97e0"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app); 


export { app, db }; 