// Sincronização opcional com o Firebase: login com Google e cópia dos dados
// no Firestore em users/{uid}/dados/principal (só o próprio usuário acessa).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA4XGEmZIvQP2ZCV32LwGUN2ILTvzFSYTs",
    authDomain: "meu-sistema-d697f.firebaseapp.com",
    projectId: "meu-sistema-d697f",
    storageBucket: "meu-sistema-d697f.firebasestorage.app",
    messagingSenderId: "586853367044",
    appId: "1:586853367044:web:e2c99d1d7906ab0969e451",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let usuario = null;

const refUsuario = () => doc(db, "users", usuario.uid, "dados", "principal");

export async function salvarNuvem(dados) {
    if (!usuario) return false;
    await setDoc(refUsuario(), { json: JSON.stringify(dados), atualizadoEm: dados.atualizadoEm || Date.now() });
    return true;
}

export async function lerNuvem() {
    if (!usuario) return null;
    const snap = await getDoc(refUsuario());
    return snap.exists() ? JSON.parse(snap.data().json) : null;
}

export const entrar = () => signInWithPopup(auth, new GoogleAuthProvider());
export const sair = () => signOut(auth);

export function observarLogin(callback) {
    onAuthStateChanged(auth, (u) => {
        usuario = u;
        callback(u);
    });
}
