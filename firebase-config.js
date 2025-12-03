
// Configuration Firebase pour votre projet ChatApp
export const firebaseConfig = {
    apiKey: "AIzaSyCb5Xkn-d2xiyQ8isQcan5v7L-i5RbxcBs",
    authDomain: "chat-app-4865d.firebaseapp.com",
    databaseURL: "https://chat-app-4865d-default-rtdb.europe-west1.firebasedatabase.app/", 
    projectId: "chat-app-4865d",
    storageBucket: "chat-app-4865d.firebasestorage.app",
    messagingSenderId: "251174960384",
    appId: "1:251174960384:web:c1fa118f999f7eb02d47e5",
    measurementId: "G-CQKD7W7TKE"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Exporter la référence à la base de données pour l'utiliser dans script.js

window.db = firebase.database();
