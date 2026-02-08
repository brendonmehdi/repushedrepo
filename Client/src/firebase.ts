import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAzzeMDFEKljycoA-7zAFTpEuzNBBsS51I",
    authDomain: "vibescribe-24cb6.firebaseapp.com",
    projectId: "vibescribe-24cb6",
    storageBucket: "vibescribe-24cb6.firebasestorage.app",
    messagingSenderId: "997326581046",
    appId: "1:997326581046:web:0d36c3e8af51e6dccb9797",
    measurementId: "G-HYLZCFQ85W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();


export {auth, app}