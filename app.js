// Import des fonctions Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    push, 
    onValue, 
    update, 
    remove,
    onChildAdded,
    get
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

// Variables globales
let currentUser = {
    id: null,
    name: "Une personne",
    avatar: "User",
    avatarType: "avataaars",
    isTyping: false,
    lastTypingTime: 0
};

let currentRoom = "general";
let rooms = {};
let users = {};
let db;
let isInitialLoad = true;
let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 1000; // 1 seconde entre les messages
const MAX_MESSAGES_PER_ROOM = 100;

// Initialiser Firebase
function initializeFirebaseApp() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        
        console.log("Firebase initialisé avec succès!");
        console.log("Database URL:", firebaseConfig.databaseURL);
        
        // Test de connexion simple
        const testRef = ref(db, '.info/connected');
        onValue(testRef, (snapshot) => {
            if (snapshot.val() === true) {
                console.log("✅ Connecté à Firebase Realtime Database");
            } else {
                console.log("❌ Non connecté à Firebase");
            }
        });
        
        // Générer un ID utilisateur unique
        currentUser.id = generateUserId();
        
        // Initialiser l'application
        initChatApp();
        
    } catch (error) {
        console.error("Erreur d'initialisation Firebase:", error);
        alert("Erreur de connexion à la base de données: " + error.message);
    }
}

// Initialiser l'application de chat
function initChatApp() {
    console.log("Application de chat initialisée");
    
    // Charger les données initiales
    loadRooms();
    loadUsers();
    setupEventListeners();
}

// Générer un ID utilisateur unique
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Enregistrer l'utilisateur dans la liste des utilisateurs en ligne
function registerUser() {
    if (!db) return;
    
    const userRef = ref(db, 'users/' + currentUser.id);
    
    const userData = {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        avatarType: currentUser.avatarType,
        lastActive: Date.now(),
        isTyping: false,
        currentRoom: currentRoom
    };
    
    set(userRef, userData);
    
    // Mettre à jour périodiquement le timestamp d'activité
    setInterval(() => {
        if (db) {
            update(userRef, { lastActive: Date.now() });
        }
    }, 30000);
}

// Charger les salons depuis Firebase
function loadRooms() {
    if (!db) return;
    
    const roomsRef = ref(db, 'rooms');
    
    onValue(roomsRef, (snapshot) => {
        const roomsData = snapshot.val();
        
        if (roomsData) {
            rooms = roomsData;
            updateRoomList();
            
            // Si c'est le premier chargement, rejoindre le salon général
            if (isInitialLoad) {
                isInitialLoad = false;
                joinRoom("general");
            }
        } else {
            // Créer le salon général par défaut
            rooms = {
                general: {
                    name: "Général",
                    description: "Salon de discussion général",
                    created: Date.now(),
                    users: {}
                }
            };
            
            set(roomsRef, rooms).then(() => {
                updateRoomList();
                if (isInitialLoad) {
                    isInitialLoad = false;
                    joinRoom("general");
                }
            }).catch(error => {
                console.error("Erreur lors de la création du salon général:", error);
            });
        }
    });
}

// Charger les utilisateurs connectés
function loadUsers() {
    if (!db) return;
    
    const usersRef = ref(db, 'users');
    
    onValue(usersRef, (snapshot) => {
        const usersData = snapshot.val();
        
        if (usersData) {
            users = usersData;
            updateUserList();
            
            // Mettre à jour le compteur d'utilisateurs connectés
            const onlineCount = Object.keys(users).length;
            document.getElementById('user-count').textContent = onlineCount;
        } else {
            users = {};
            document.getElementById('user-count').textContent = 0;
        }
    });
}

// Mettre à jour la liste des salons dans l'interface
function updateRoomList() {
    const roomList = document.getElementById('room-list');
    if (!roomList) return;
    
    roomList.innerHTML = '';
    
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const userCount = room.users ? Object.keys(room.users).length : 0;
        
        const roomItem = document.createElement('div');
        roomItem.className = `room-item ${roomId === currentRoom ? 'active' : ''}`;
        roomItem.setAttribute('data-room', roomId);
        roomItem.innerHTML = `
            <i class="fas ${roomId === 'general' ? 'fa-globe' : 'fa-hashtag'}"></i>
            <span>${room.name}</span>
            <span class="room-counter">${userCount}</span>
        `;
        
        roomItem.addEventListener('click', () => {
            joinRoom(roomId);
        });
        
        room
