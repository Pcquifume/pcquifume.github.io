// Import des fonctions Firebase
//test
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    push, 
    onValue, 
    update, 
    remove,
    onChildAdded
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

// Variables globales
let currentUser = {
    id: null,
    name: "Une personne",
    avatar: "User",
    isTyping: false,
    lastTypingTime: 0
};

let currentRoom = "general";
let rooms = {};
let users = {};
let db;

// Initialiser Firebase
function initializeFirebaseApp() {  // CHANGEMENT: Renommé la fonction
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        
        // Vérifier la connexion à la base de données
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
        initChatApp();  // CHANGEMENT: Appel à la nouvelle fonction
        
    } catch (error) {
        console.error("Erreur d'initialisation Firebase:", error);
        alert("Erreur de connexion à la base de données: " + error.message);
    }
}

// Initialiser l'application de chat (renommé)
function initChatApp() {  // CHANGEMENT: Nouveau nom pour éviter le conflit
    console.log("Application de chat initialisée");
    
    // Charger les données initiales
    loadRooms();
    loadUsers();
    setupEventListeners();
    joinRoom(currentRoom);
    
    // Enregistrer l'utilisateur dans Firebase
    registerUser();
}

// Afficher un avertissement si databaseURL n'est pas configuré
function showDatabaseWarning() {
    const messagesContainer = document.getElementById('messages-container');
    const warning = document.createElement('div');
    warning.className = 'warning-message';
    warning.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #856404; margin-bottom: 10px;">
                <i class="fas fa-exclamation-triangle"></i> Configuration requise
            </h3>
            <p style="color: #856404;">
                Pour que le chat fonctionne, vous devez:
                <ol style="margin-left: 20px;">
                    <li>Aller sur <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
                    <li>Activer la <strong>Realtime Database</strong> dans votre projet</li>
                    <li>Ajouter <code>databaseURL</code> dans le fichier firebase-config.js</li>
                </ol>
                Sans cette étape, le chat ne pourra pas sauvegarder les messages.
            </p>
        </div>
    `;
    messagesContainer.insertBefore(warning, messagesContainer.firstChild);
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
        lastActive: Date.now(),
        isTyping: false,
        currentRoom: currentRoom
    };
    
    set(userRef, userData);
    
    // Mettre à jour périodiquement le timestamp d'activité
    setInterval(() => {
        update(userRef, { lastActive: Date.now() });
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
            set(roomsRef, rooms);
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
        
        roomList.appendChild(roomItem);
    }
}

// Mettre à jour la liste des utilisateurs en ligne
function updateUserList() {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    
    for (const userId in users) {
        const user = users[userId];
        if (userId === currentUser.id) continue;
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}" class="user-avatar" alt="${user.name}">
            <div class="user-details">
                <div class="user-name">${user.name}</div>
                <div class="user-activity">${user.isTyping ? 'est en train d\'écrire...' : 'en ligne'}</div>
            </div>
        `;
        
        userList.appendChild(userItem);
    }
}

// Rejoindre un salon
function joinRoom(roomId) {
    if (!db) return;
    
    // Quitter le salon précédent
    if (currentRoom) {
        const prevRoomRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
        remove(prevRoomRef);
    }
    
    // Mettre à jour la salle courante
    currentRoom = roomId;
    const room = rooms[roomId];
    
    // Mettre à jour l'interface
    document.getElementById('current-room').textContent = room.name;
    document.getElementById('room-description').textContent = room.description || "Salon de discussion";
    
    // Mettre à jour la liste des salons
    updateRoomList();
    
    // Rejoindre le nouveau salon
    const roomRef = ref(db, `rooms/${roomId}/users/${currentUser.id}`);
    set(roomRef, {
        name: currentUser.name,
        avatar: currentUser.avatar,
        joined: Date.now()
    });
    
    // Mettre à jour la salle courante de l'utilisateur
    const userRef = ref(db, `users/${currentUser.id}`);
    update(userRef, { currentRoom: roomId });
    
    // Charger les messages du salon
    loadMessages(roomId);
    
    // Écouter les nouveaux messages
    listenToNewMessages(roomId);
    
    // Écouter les indicateurs de saisie
    listenToTypingIndicator(roomId);
}

// Charger les messages d'un salon
function loadMessages(roomId) {
    if (!db) return;
    
    const messagesContainer = document.getElementById('messages-container');
    
    // Conserver uniquement le message de bienvenue
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    messagesContainer.innerHTML = '';
    if (welcomeMessage) {
        messagesContainer.appendChild(welcomeMessage);
    }
    
    const messagesRef = ref(db, `messages/${roomId}`);
    
    onValue(messagesRef, (snapshot) => {
        const messagesData = snapshot.val();
        
        if (messagesData) {
            // Convertir l'objet en tableau et trier par timestamp
            const messagesArray = Object.values(messagesData);
            messagesArray.sort((a, b) => a.timestamp - b.timestamp);
            
            // Afficher chaque message
            messagesArray.forEach(message => {
                displayMessage(message);
            });
            
            // Faire défiler vers le bas
            scrollToBottom();
        }
    });
}

// Écouter les nouveaux messages
function listenToNewMessages(roomId) {
    if (!db) return;
    
    const messagesRef = ref(db, `messages/${roomId}`);
    
    onChildAdded(messagesRef, (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key;
        
        // Vérifier si le message n'a pas déjà été affiché
        const existingMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (!existingMessage) {
            displayMessage(message, messageId);
            scrollToBottom();
        }
    });
}

// Écouter les indicateurs de saisie
function listenToTypingIndicator(roomId) {
    if (!db) return;
    
    const typingRef = ref(db, `typing/${roomId}`);
    
    onValue(typingRef, (snapshot) => {
        const typingData = snapshot.val();
        const typingIndicator = document.getElementById('typing-indicator');
        
        if (typingData) {
            // Filtrer les utilisateurs qui sont en train de taper (sauf soi-même)
            const typingUsers = Object.values(typingData)
                .filter(user => user.userId !== currentUser.id && user.isTyping)
                .map(user => user.userName);
            
            if (typingUsers.length > 0) {
                let text = '';
                if (typingUsers.length === 1) {
                    text = `${typingUsers[0]} est en train d'écrire...`;
                } else if (typingUsers.length === 2) {
                    text = `${typingUsers[0]} et ${typingUsers[1]} sont en train d'écrire...`;
                } else {
                    text = `${typingUsers[0]} et ${typingUsers.length - 1} autres sont en train d'écrire...`;
                }
                typingIndicator.textContent = text;
            } else {
                typingIndicator.textContent = '';
            }
        } else {
            typingIndicator.textContent = '';
        }
    });
}

// Afficher un message
function displayMessage(message, messageId = null) {
    const messagesContainer = document.getElementById('messages-container');
    const isOwnMessage = message.userId === currentUser.id;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    
    const time = new Date(message.timestamp);
    const timeString = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${message.avatar}" class="message-avatar" alt="${message.userName}">
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${message.userName}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-text">${message.text}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Envoyer un message
function sendMessage() {
    if (!db) {
        alert("Base de données non connectée. Vérifiez la configuration Firebase.");
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (text === '') return;
    
    const message = {
        userId: currentUser.id,
        userName: currentUser.name,
        avatar: currentUser.avatar,
        text: text,
        timestamp: Date.now(),
        roomId: currentRoom
    };
    
    // Envoyer le message à Firebase
    const messagesRef = ref(db, `messages/${currentRoom}`);
    const newMessageRef = push(messagesRef);
    set(newMessageRef, message);
    
    // Réinitialiser le champ de saisie
    messageInput.value = '';
    
    // Arrêter l'indicateur de saisie
    stopTypingIndicator();
}

// Gérer l'indicateur de saisie
function startTypingIndicator() {
    if (!db || !currentUser.isTyping) {
        currentUser.isTyping = true;
        currentUser.lastTypingTime = Date.now();
        
        if (db) {
            const typingRef = ref(db, `typing/${currentRoom}/${currentUser.id}`);
            set(typingRef, {
                userId: currentUser.id,
                userName: currentUser.name,
                isTyping: true,
                timestamp: Date.now()
            });
        }
    } else {
        currentUser.lastTypingTime = Date.now();
    }
    
    // Vérifier périodiquement si l'utilisateur a arrêté de taper
    setTimeout(checkTyping, 1000);
}

function checkTyping() {
    const timeSinceLastTyping = Date.now() - currentUser.lastTypingTime;
    
    if (timeSinceLastTyping > 2000 && currentUser.isTyping) {
        stopTypingIndicator();
    }
}

function stopTypingIndicator() {
    if (currentUser.isTyping) {
        currentUser.isTyping = false;
        
        if (db) {
            const typingRef = ref(db, `typing/${currentRoom}/${currentUser.id}`);
            update(typingRef, {
                isTyping: false,
                timestamp: Date.now()
            });
        }
    }
}

// Faire défiler vers le bas de la conversation
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Créer un nouveau salon
function createRoom(name, description) {
    if (!db) {
        alert("Base de données non connectée. Impossible de créer un salon.");
        return;
    }
    
    if (!name || name.trim() === '') {
        alert('Veuillez donner un nom au salon');
        return;
    }
    
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newRoom = {
        name: name.trim(),
        description: description || '',
        created: Date.now(),
        users: {}
    };
    
    // Ajouter le salon à Firebase
    const roomsRef = ref(db, 'rooms');
    const roomRef = ref(db, `rooms/${roomId}`);
    set(roomRef, newRoom);
    
    // Rejoindre le nouveau salon
    joinRoom(roomId);
    
    // Fermer le modal
    closeCreateRoomModal();
}

// Gestionnaires d'événements
function setupEventListeners() {
    // Envoyer un message
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    
    // Envoyer avec la touche Entrée
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Indicateur de saisie
    document.getElementById('message-input').addEventListener('input', startTypingIndicator);
    
    // Changer de pseudo
    document.getElementById('username-input').addEventListener('change', (e) => {
        const newName = e.target.value.trim() || "Une personne";
        currentUser.name = newName;
        
        // Mettre à jour dans Firebase
        if (db && currentRoom) {
            const userRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
            update(userRef, { name: newName });
            
            const usersRef = ref(db, `users/${currentUser.id}`);
            update(usersRef, { name: newName });
        }
    });
    
    // Changer d'avatar
    document.getElementById('current-avatar').addEventListener('click', () => {
        const avatarOptions = document.getElementById('avatar-options');
        avatarOptions.style.display = avatarOptions.style.display === 'flex' ? 'none' : 'flex';
    });
    
    // Sélectionner un avatar
    document.querySelectorAll('#avatar-options img').forEach(img => {
        img.addEventListener('click', (e) => {
            const seed = e.target.getAttribute('data-seed');
            currentUser.avatar = seed;
            
            // Mettre à jour l'avatar affiché
            document.getElementById('current-avatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
            
            // Mettre à jour dans Firebase
            if (db && currentRoom) {
                const userRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
                update(userRef, { avatar: seed });
                
                const usersRef = ref(db, `users/${currentUser.id}`);
                update(usersRef, { avatar: seed });
            }
        });
    });
    
    // Modal pour créer un salon
    document.getElementById('create-room-btn').addEventListener('click', () => {
        document.getElementById('create-room-modal').style.display = 'flex';
    });
    
    document.querySelector('.close-modal').addEventListener('click', closeCreateRoomModal);
    
    document.getElementById('confirm-create-room').addEventListener('click', () => {
        const roomName = document.getElementById('room-name').value;
        const roomDescription = document.getElementById('room-description-input').value;
        createRoom(roomName, roomDescription);
    });
    
    // Fermer le modal en cliquant à l'extérieur
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('create-room-modal');
        if (e.target === modal) {
            closeCreateRoomModal();
        }
    });
}

function closeCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'none';
    document.getElementById('room-name').value = '';
    document.getElementById('room-description-input').value = '';
}

// Gestion de la connexion/déconnexion
window.addEventListener('beforeunload', () => {
    if (db) {
        // Quitter le salon actuel
        if (currentRoom) {
            const roomRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
            remove(roomRef);
        }
        
        // Supprimer l'utilisateur de la liste des utilisateurs en ligne
        const userRef = ref(db, `users/${currentUser.id}`);
        remove(userRef);
    }
});

// Initialiser Firebase quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebaseApp();  // CHANGEMENT: Appel à la fonction renommée
});

