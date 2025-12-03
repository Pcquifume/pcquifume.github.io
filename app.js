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
let isInitialLoad = true;

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
        
        roomList.appendChild(roomItem);
    }
}

// Mettre à jour la liste des utilisateurs en ligne
function updateUserList() {
    const userList = document.getElementById('user-list');
    if (!userList) return;
    
    userList.innerHTML = '';
    
    for (const userId in users) {
        const user = users[userId];
        if (userId === currentUser.id) continue;
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar || 'User'}" class="user-avatar" alt="${user.name}">
            <div class="user-details">
                <div class="user-name">${user.name || 'Utilisateur'}</div>
                <div class="user-activity">${user.isTyping ? 'est en train d\'écrire...' : 'en ligne'}</div>
            </div>
        `;
        
        userList.appendChild(userItem);
    }
}

// Rejoindre un salon
function joinRoom(roomId) {
    if (!db) {
        console.error("Firebase Database n'est pas initialisé");
        return;
    }
    
    // Vérifier si le salon existe
    if (!rooms[roomId]) {
        console.warn(`Le salon ${roomId} n'existe pas`);
        
        // Si c'est le salon général, créer une structure temporaire
        if (roomId === "general") {
            rooms[roomId] = {
                name: "Général",
                description: "Salon de discussion général",
                users: {}
            };
        } else {
            return;
        }
    }
    
    // Quitter le salon précédent
    if (currentRoom && currentRoom !== roomId) {
        const prevRoomRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
        remove(prevRoomRef).catch(error => {
            console.error("Erreur en quittant le salon précédent:", error);
        });
    }
    
    // Mettre à jour la salle courante
    currentRoom = roomId;
    const room = rooms[roomId];
    
    // Mettre à jour l'interface
    const currentRoomElement = document.getElementById('current-room');
    const roomDescriptionElement = document.getElementById('room-description');
    
    if (currentRoomElement) currentRoomElement.textContent = room.name;
    if (roomDescriptionElement) roomDescriptionElement.textContent = room.description || "Salon de discussion";
    
    // Mettre à jour la liste des salons
    updateRoomList();
    
    // Enregistrer l'utilisateur s'il n'est pas encore enregistré
    if (!users[currentUser.id]) {
        registerUser();
    }
    
    // Rejoindre le nouveau salon dans Firebase
    const roomRef = ref(db, `rooms/${roomId}/users/${currentUser.id}`);
    set(roomRef, {
        name: currentUser.name,
        avatar: currentUser.avatar,
        joined: Date.now()
    }).catch(error => {
        console.error("Erreur en rejoignant le salon:", error);
    });
    
    // Mettre à jour la salle courante de l'utilisateur
    const userRef = ref(db, `users/${currentUser.id}`);
    update(userRef, { 
        currentRoom: roomId,
        lastActive: Date.now()
    }).catch(error => {
        console.error("Erreur mise à jour utilisateur:", error);
    });
    
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
    if (!messagesContainer) return;
    
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
        
        if (!typingIndicator) return;
        
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
    if (!messagesContainer) return;
    
    const isOwnMessage = message.userId === currentUser.id;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    
    const time = new Date(message.timestamp);
    const timeString = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${message.avatar || 'User'}" class="message-avatar" alt="${message.userName}">
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
    if (!messageInput) return;
    
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
    set(newMessageRef, message).catch(error => {
        console.error("Erreur en envoyant le message:", error);
        alert("Erreur en envoyant le message: " + error.message);
    });
    
    // Réinitialiser le champ de saisie
    messageInput.value = '';
    
    // Arrêter l'indicateur de saisie
    stopTypingIndicator();
}

// Gérer l'indicateur de saisie
function startTypingIndicator() {
    if (!db) return;
    
    if (!currentUser.isTyping) {
        currentUser.isTyping = true;
        currentUser.lastTypingTime = Date.now();
        
        const typingRef = ref(db, `typing/${currentRoom}/${currentUser.id}`);
        set(typingRef, {
            userId: currentUser.id,
            userName: currentUser.name,
            isTyping: true,
            timestamp: Date.now()
        }).catch(error => {
            console.error("Erreur indicateur de saisie:", error);
        });
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
            }).catch(error => {
                console.error("Erreur arrêt indicateur de saisie:", error);
            });
        }
    }
}

// Faire défiler vers le bas de la conversation
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    set(roomRef, newRoom).then(() => {
        // Rejoindre le nouveau salon
        joinRoom(roomId);
        
        // Fermer le modal
        closeCreateRoomModal();
    }).catch(error => {
        console.error("Erreur création salon:", error);
        alert("Erreur en créant le salon: " + error.message);
    });
}

// Gestionnaires d'événements
function setupEventListeners() {
    // Envoyer un message
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Envoyer avec la touche Entrée
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Indicateur de saisie
        messageInput.addEventListener('input', startTypingIndicator);
    }
    
    // Changer de pseudo
    const usernameInput = document.getElementById('username-input');
    if (usernameInput) {
        usernameInput.addEventListener('change', (e) => {
            const newName = e.target.value.trim() || "Une personne";
            currentUser.name = newName;
            
            // Mettre à jour dans Firebase
            if (db && currentRoom) {
                const userRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
                update(userRef, { name: newName }).catch(error => {
                    console.error("Erreur mise à jour pseudo:", error);
                });
                
                const usersRef = ref(db, `users/${currentUser.id}`);
                update(usersRef, { name: newName }).catch(error => {
                    console.error("Erreur mise à jour pseudo utilisateur:", error);
                });
            }
        });
    }
    
    // Changer d'avatar
    const currentAvatar = document.getElementById('current-avatar');
    if (currentAvatar) {
        currentAvatar.addEventListener('click', () => {
            const avatarOptions = document.getElementById('avatar-options');
            if (avatarOptions) {
                avatarOptions.style.display = avatarOptions.style.display === 'flex' ? 'none' : 'flex';
            }
        });
    }
    
    // Sélectionner un avatar
    document.querySelectorAll('#avatar-options img').forEach(img => {
        img.addEventListener('click', (e) => {
            const seed = e.target.getAttribute('data-seed');
            currentUser.avatar = seed;
            
            // Mettre à jour l'avatar affiché
            const currentAvatarImg = document.getElementById('current-avatar');
            if (currentAvatarImg) {
                currentAvatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
            }
            
            // Mettre à jour dans Firebase
            if (db && currentRoom) {
                const userRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
                update(userRef, { avatar: seed }).catch(error => {
                    console.error("Erreur mise à jour avatar:", error);
                });
                
                const usersRef = ref(db, `users/${currentUser.id}`);
                update(usersRef, { avatar: seed }).catch(error => {
                    console.error("Erreur mise à jour avatar utilisateur:", error);
                });
            }
        });
    });
    
    // Modal pour créer un salon
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            const modal = document.getElementById('create-room-modal');
            if (modal) {
                modal.style.display = 'flex';
            }
        });
    }
    
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeCreateRoomModal);
    }
    
    const confirmCreateRoomBtn = document.getElementById('confirm-create-room');
    if (confirmCreateRoomBtn) {
        confirmCreateRoomBtn.addEventListener('click', () => {
            const roomNameInput = document.getElementById('room-name');
            const roomDescInput = document.getElementById('room-description-input');
            
            if (roomNameInput && roomDescInput) {
                const roomName = roomNameInput.value;
                const roomDescription = roomDescInput.value;
                createRoom(roomName, roomDescription);
            }
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('create-room-modal');
        if (e.target === modal) {
            closeCreateRoomModal();
        }
    });
}

function closeCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    const roomNameInput = document.getElementById('room-name');
    const roomDescInput = document.getElementById('room-description-input');
    
    if (roomNameInput) roomNameInput.value = '';
    if (roomDescInput) roomDescInput.value = '';
}

// Gestion de la connexion/déconnexion
window.addEventListener('beforeunload', () => {
    if (db) {
        // Quitter le salon actuel
        if (currentRoom) {
            const roomRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
            remove(roomRef).catch(error => {
                console.error("Erreur nettoyage salon:", error);
            });
        }
        
        // Supprimer l'utilisateur de la liste des utilisateurs en ligne
        const userRef = ref(db, `users/${currentUser.id}`);
        remove(userRef).catch(error => {
            console.error("Erreur nettoyage utilisateur:", error);
        });
        
        // Supprimer l'indicateur de saisie
        const typingRef = ref(db, `typing/${currentRoom}/${currentUser.id}`);
        remove(typingRef).catch(error => {
            console.error("Erreur nettoyage indicateur de saisie:", error);
        });
    }
});

// Initialiser Firebase quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebaseApp();
});
