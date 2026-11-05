import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcBLeo9-aSKULcuOOkx5OX2cQqIEm0mPI",
  authDomain: "exam-crunch-planner.firebaseapp.com",
  projectId: "exam-crunch-planner",
  storageBucket: "exam-crunch-planner.firebasestorage.app",
  messagingSenderId: "53129124578",
  appId: "1:53129124578:web:0961e516ffd8eab9f19cbb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);