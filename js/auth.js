import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || extra.name || "",
      email: user.email,
      createdAt: serverTimestamp()
    });
  }
}

export async function signUp(name, email, password) {
  window.__authBusy = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user, { name });
    return cred.user;
  } finally { window.__authBusy = false; }
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function googleSignIn() {
  window.__authBusy = true;
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserDoc(cred.user);
    return cred.user;
  } finally { window.__authBusy = false; }
}

export const logOut = () => signOut(auth);

export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "login.html"; return; }
    await ensureUserDoc(user);
    callback(user);
  });
}

export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user && !window.__authBusy) location.href = "dashboard.html";
  });
}

export function friendlyError(err) {
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/too-many-requests": "Too many attempts. Try again later."
  };
  return map[err.code] || err.message;
}