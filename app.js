// Configuration Firebase
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
    onChildRemoved
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCb5Xkn-d2xiyQ8isQcan5v7L-i5RbxcBs",
    authDomain: "chat-app-4865d.firebaseapp.com",
    databaseURL: "https://chat-app-4865d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "chat-app-4865d",
    storageBucket: "chat-app-4865d.firebasestorage.app",
    messagingSenderId: "251174960384",
    appId: "1:251174960384:web:c1fa118f999f7eb02d47e5",
    measurementId: "G-CQKD7W7TKE"
};

// Variables globales
let db;
let currentUser = {
    id: null,
    name: "",
    currentRoom: "general"
};

let rooms = {};
let onlineUsers = new Map(); // Pour éviter les pseudos dupliqués
let typingUsers = new Map();

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("Firebase initialisé avec succès");
        initializeAppLogic();
    } catch (error) {
        console.error("Erreur Firebase:", error);
        alert("Erreur de connexion au serveur. Vérifiez votre connexion Internet.");
    }
});

function initializeAppLogic() {
    setupEventListeners();
    loadInitialData();
    updateOnlineCount();
}

function setupEventListeners() {
    // Écran de connexion
    document.getElementById('join-chat-btn').addEventListener('click', joinChat);
    document.getElementById('username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinChat();
    });
    document.getElementById('create-room-btn').addEventListener('click', showCreateRoomModal);

    // Chat
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('create-new-room').addEventListener('click', showCreateRoomModal);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', handleMessageInputKeypress);
    document.getElementById('message-input').addEventListener('input', handleTyping);

    // Modal
    document.getElementById('confirm-create-room').addEventListener('click', createRoom);
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', hideCreateRoomModal);
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.id === 'create-room-modal') {
            hideCreateRoomModal();
        }
    });
}

function loadInitialData() {
    // Charger les salons existants
    const roomsRef = ref(db, 'rooms');
    onValue(roomsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            rooms = data;
            updateRoomSelect();
        } else {
            // Créer le salon général par défaut
            rooms = {
                general: {
                    name: "Général",
                    description: "Salon de discussion général",
                    created: Date.now(),
                    createdBy: "system"
                }
            };
            set(roomsRef, rooms);
        }
    });
}

function updateOnlineCount() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val() || {};
        const count = Object.keys(users).length;
        document.getElementById('online-count').textContent = count;
    });
}

function updateRoomSelect() {
    const select = document.getElementById('room-select');
    const currentValue = select.value;
    
    // Garder seulement l'option Général et vider le reste
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Ajouter les autres salons
    Object.entries(rooms).forEach(([id, room]) => {
        if (id !== 'general') {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = room.name;
            select.appendChild(option);
        }
    });
    
    // Restaurer la sélection précédente si possible
    if (rooms[currentValue]) {
        select.value = currentValue;
    }
}

// Gestion des utilisateurs
async function joinChat() {
    const usernameInput = document.getElementById('username');
    const roomSelect = document.getElementById('room-select');
    
    const username = usernameInput.value.trim();
    const roomId = roomSelect.value;
    
    // Validation
    if (!username) {
        showError(usernameInput, "Veuillez entrer un pseudo");
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showError(usernameInput, "Le pseudo doit contenir entre 3 et 20 caractères");
        return;
    }
    
    // Vérifier si le pseudo est déjà utilisé
    const usersRef = ref(db, 'users');
    const snapshot = await getSnapshotOnce(usersRef);
    const users = snapshot.val() || {};
    
    const isUsernameTaken = Object.values(users).some(user => 
        user.name.toLowerCase() === username.toLowerCase() && user.id !== currentUser.id
    );
    
    if (isUsernameTaken) {
        showError(usernameInput, "Ce pseudo est déjà utilisé. Veuillez en choisir un autre.");
        return;
    }
    
    // Créer l'utilisateur
    currentUser = {
        id: generateUserId(),
        name: username,
        currentRoom: roomId,
        joinedAt: Date.now()
    };
    
    // Enregistrer l'utilisateur dans Firebase
    const userRef = ref(db, `users/${currentUser.id}`);
    await set(userRef, {
        id: currentUser.id,
        name: currentUser.name,
        currentRoom: currentUser.currentRoom,
        lastActive: Date.now(),
        isTyping: false
    });
    
    // Mettre à jour périodiquement l'activité
    setInterval(() => {
        if (currentUser.id) {
            update(userRef, { lastActive: Date.now() });
        }
    }, 30000);
    
    // Afficher l'interface de chat
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'block';
    
    // Mettre à jour l'interface
    document.getElementById('current-username').textContent = currentUser.name;
    
    // Rejoindre le salon
    joinRoom(roomId);
    
    // Écouter les changements d'utilisateurs
    setupUsersListener();
}

function logout() {
    if (currentUser.id && db) {
        // Supprimer l'utilisateur de Firebase
        const userRef = ref(db, `users/${currentUser.id}`);
        remove(userRef);
        
        // Quitter le salon actuel
        if (currentUser.currentRoom) {
            const roomUserRef = ref(db, `rooms/${currentUser.currentRoom}/users/${currentUser.id}`);
            remove(roomUserRef);
        }
    }
    
    // Réinitialiser
    currentUser = { id: null, name: "", currentRoom: "general" };
    onlineUsers.clear();
    typingUsers.clear();
    
    // Retour à l'écran de connexion
    document.getElementById('chat-interface').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('message-input').value = '';
}

function setupUsersListener() {
    const usersRef = ref(db, 'users');
    
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val() || {};
        onlineUsers.clear();
        
        // Mettre à jour la liste
        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        
        Object.values(users).forEach(user => {
            if (user.id === currentUser.id) return;
            
            onlineUsers.set(user.id, user);
            
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <span class="status online"></span>
                <span>${user.name}</span>
                ${user.currentRoom === currentUser.currentRoom ? 
                    `<span class="typing-indicator-small">${user.isTyping ? 'écrit...' : ''}</span>` : 
                    ''}
            `;
            userList.appendChild(userElement);
        });
    });
}

// Gestion des salons
function joinRoom(roomId) {
    if (!currentUser.id || !db) return;
    
    const room = rooms[roomId];
    if (!room) return;
    
    // Quitter le salon précédent
    if (currentUser.currentRoom) {
        const prevRoomRef = ref(db, `rooms/${currentUser.currentRoom}/users/${currentUser.id}`);
        remove(prevRoomRef);
    }
    
    // Mettre à jour la salle courante
    currentUser.currentRoom = roomId;
    
    // Mettre à jour l'utilisateur
    const userRef = ref(db, `users/${currentUser.id}`);
    update(userRef, { currentRoom: roomId });
    
    // Rejoindre le nouveau salon
    const roomUserRef = ref(db, `rooms/${roomId}/users/${currentUser.id}`);
    set(roomUserRef, {
        name: currentUser.name,
        joined: Date.now()
    });
    
    // Mettre à jour l'interface
    document.getElementById('current-room-name').textContent = room.name;
    document.getElementById('room-description').textContent = room.description || "Salon de discussion";
    
    // Mettre à jour la liste des salons
    updateRoomList();
    
    // Charger les messages
    loadMessages(roomId);
    
    // Écouter les nouveaux messages
    listenToNewMessages(roomId);
    
    // Écouter les indicateurs de saisie
    listenToTyping(roomId);
}

function updateRoomList() {
    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';
    
    Object.entries(rooms).forEach(([id, room]) => {
        const roomElement = document.createElement('div');
        roomElement.className = `room-item ${id === currentUser.currentRoom ? 'active' : ''}`;
        roomElement.setAttribute('data-room', id);
        roomElement.innerHTML = `
            <i class="fas ${id === 'general' ? 'fa-globe' : 'fa-hashtag'}"></i>
            <span>${room.name}</span>
            <span class="user-count" id="count-${id}">0</span>
        `;
        
        roomElement.addEventListener('click', () => joinRoom(id));
        roomList.appendChild(roomElement);
        
        // Écouter le nombre d'utilisateurs dans ce salon
        const roomUsersRef = ref(db, `rooms/${id}/users`);
        onValue(roomUsersRef, (snapshot) => {
            const users = snapshot.val() || {};
            const count = Object.keys(users).length;
            document.getElementById(`count-${id}`).textContent = count;
        });
    });
}

function showCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'flex';
    document.getElementById('new-room-name').focus();
}

function hideCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'none';
    document.getElementById('new-room-name').value = '';
    document.getElementById('new-room-description').value = '';
}

async function createRoom() {
    const nameInput = document.getElementById('new-room-name');
    const descInput = document.getElementById('new-room-description');
    
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    
    if (!name) {
        showError(nameInput, "Veuillez donner un nom au salon");
        return;
    }
    
    if (name.length > 30) {
        showError(nameInput, "Le nom ne peut pas dépasser 30 caractères");
        return;
    }
    
    // Vérifier si le nom existe déjà
    const roomExists = Object.values(rooms).some(room => 
        room.name.toLowerCase() === name.toLowerCase()
    );
    
    if (roomExists) {
        showError(nameInput, "Un salon avec ce nom existe déjà");
        return;
    }
    
    // Créer le salon
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newRoom = {
        name: name,
        description: description,
        created: Date.now(),
        createdBy: currentUser.id
    };
    
    // Ajouter à Firebase
    const roomRef = ref(db, `rooms/${roomId}`);
    await set(roomRef, newRoom);
    
    // Mettre à jour localement
    rooms[roomId] = newRoom;
    
    // Rejoindre le nouveau salon
    joinRoom(roomId);
    
    // Fermer le modal
    hideCreateRoomModal();
}

// Gestion des messages
function loadMessages(roomId) {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '';
    
    const messagesRef = ref(db, `messages/${roomId}`);
    
    onValue(messagesRef, (snapshot) => {
        const messages = snapshot.val() || {};
        
        // Convertir en tableau et trier par timestamp
        const messagesArray = Object.entries(messages)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        // Afficher les messages
        messagesArray.forEach(msg => displayMessage(msg));
        
        // Faire défiler vers le bas
        scrollToBottom();
    });
}

function listenToNewMessages(roomId) {
    const messagesRef = ref(db, `messages/${roomId}`);
    
    onChildAdded(messagesRef, (snapshot) => {
        const message = { id: snapshot.key, ...snapshot.val() };
        
        // Vérifier si le message n'est pas déjà affiché
        if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
            displayMessage(message);
            scrollToBottom();
        }
    });
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('messages-container');
    const isOwnMessage = message.userId === currentUser.id;
    
    // Vérifier si c'est un message système
    if (message.type === 'system') {
        const systemMsg = document.createElement('div');
        systemMsg.className = 'system-message';
        systemMsg.innerHTML = `
            <div class="message-text">${message.text}</div>
        `;
        messagesContainer.appendChild(systemMsg);
        return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageElement.setAttribute('data-message-id', message.id);
    
    const time = new Date(message.timestamp);
    const timeString = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
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

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text || !currentUser.id || !db) return;
    
    const message = {
        userId: currentUser.id,
        userName: currentUser.name,
        text: text,
        timestamp: Date.now(),
        roomId: currentUser.currentRoom
    };
    
    // Envoyer à Firebase
    const messagesRef = ref(db, `messages/${currentUser.currentRoom}`);
    const newMessageRef = push(messagesRef);
    set(newMessageRef, message);
    
    // Réinitialiser
    input.value = '';
    input.focus();
    
    // Arrêter l'indicateur de saisie
    stopTyping();
}

function handleMessageInputKeypress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Gestion de la saisie
let typingTimeout;
let isTyping = false;

function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        startTyping();
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        stopTyping();
    }, 2000);
}

function startTyping() {
    if (!currentUser.id || !db) return;
    
    const typingRef = ref(db, `typing/${currentUser.currentRoom}/${currentUser.id}`);
    set(typingRef, {
        userName: currentUser.name,
        isTyping: true,
        timestamp: Date.now()
    });
}

function stopTyping() {
    if (!currentUser.id || !db) return;
    
    const typingRef = ref(db, `typing/${currentUser.currentRoom}/${currentUser.id}`);
    update(typingRef, {
        isTyping: false,
        timestamp: Date.now()
    });
}

function listenToTyping(roomId) {
    const typingRef = ref(db, `typing/${roomId}`);
    
    onValue(typingRef, (snapshot) => {
        const typingData = snapshot.val() || {};
        const indicator = document.getElementById('typing-indicator');
        
        // Filtrer les utilisateurs qui tapent (sauf soi-même)
        const typingUsersList = Object.values(typingData)
            .filter(user => user.isTyping && user.userName !== currentUser.name)
            .map(user => user.userName);
        
        if (typingUsersList.length === 0) {
            indicator.textContent = '';
        } else if (typingUsersList.length === 1) {
            indicator.textContent = `${typingUsersList[0]} est en train d'écrire...`;
        } else if (typingUsersList.length === 2) {
            indicator.textContent = `${typingUsersList[0]} et ${typingUsersList[1]} sont en train d'écrire...`;
        } else {
            indicator.textContent = `${typingUsersList[0]} et ${typingUsersList.length - 1} autres sont en train d'écrire...`;
        }
    });
}

// Utilitaires
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showError(inputElement, message) {
    // Ajouter une classe d'erreur
    inputElement.classList.add('error');
    
    // Afficher un message temporaire
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        color: var(--danger-color);
        font-size: 14px;
        margin-top: 8px;
        padding: 8px;
        background-color: rgba(239, 68, 68, 0.1);
        border-radius: var(--radius-sm);
    `;
    
    // Supprimer l'ancienne erreur
    const oldError = inputElement.parentNode.querySelector('.error-message');
    if (oldError) oldError.remove();
    
    inputElement.parentNode.appendChild(errorDiv);
    
    // Focus sur le champ
    inputElement.focus();
    
    // Supprimer la classe d'erreur après 3 secondes
    setTimeout(() => {
        inputElement.classList.remove('error');
        errorDiv.remove();
    }, 3000);
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// Fonction utilitaire pour obtenir une snapshot une fois
function getSnapshotOnce(ref) {
    return new Promise((resolve) => {
        onValue(ref, (snapshot) => {
            resolve(snapshot);
        }, { onlyOnce: true });
    });
}

// Gestion de la fermeture de la page
window.addEventListener('beforeunload', () => {
    logout();
});
