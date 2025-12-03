// Ajoutez cette variable globale
let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 1000; // 1 seconde entre les messages
const MAX_MESSAGES_PER_ROOM = 100;

// Modifiez la fonction sendMessage()
async function sendMessage() {
    if (!db) {
        alert("Base de données non connectée.");
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    
    if (text === '') return;
    
    // Prévenir l'envoi de messages trop rapides
    const now = Date.now();
    if (now - lastMessageTime < MESSAGE_COOLDOWN) {
        console.log("Attendez avant d'envoyer un autre message");
        return;
    }
    lastMessageTime = now;
    
    const message = {
        userId: currentUser.id,
        userName: currentUser.name,
        avatar: currentUser.avatar,
        avatarType: currentUser.avatarType || 'avataaars',
        text: text,
        timestamp: Date.now(),
        roomId: currentRoom
    };
    
    try {
        // Envoyer le message à Firebase
        const messagesRef = ref(db, `messages/${currentRoom}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, message);
        
        // Limiter le nombre de messages
        await limitMessages(currentRoom);
        
        // Réinitialiser le champ de saisie
        messageInput.value = '';
        
        // Arrêter l'indicateur de saisie
        stopTypingIndicator();
        
    } catch (error) {
        console.error("Erreur en envoyant le message:", error);
        alert("Erreur en envoyant le message: " + error.message);
    }
}

// Fonction pour limiter les messages à 100 par salon
async function limitMessages(roomId) {
    if (!db) return;
    
    try {
        const messagesRef = ref(db, `messages/${roomId}`);
        const snapshot = await get(messagesRef);
        
        if (snapshot.exists()) {
            const messages = snapshot.val();
            const messageIds = Object.keys(messages);
            
            // Si plus de 100 messages, supprimer les plus anciens
            if (messageIds.length > MAX_MESSAGES_PER_ROOM) {
                // Trier les messages par timestamp
                const sortedMessages = Object.entries(messages)
                    .sort(([, a], [, b]) => a.timestamp - b.timestamp);
                
                // Garder seulement les 100 plus récents
                const toKeep = sortedMessages.slice(-MAX_MESSAGES_PER_ROOM);
                const toDelete = sortedMessages.slice(0, sortedMessages.length - MAX_MESSAGES_PER_ROOM);
                
                // Supprimer les anciens messages
                for (const [messageId] of toDelete) {
                    const messageRef = ref(db, `messages/${roomId}/${messageId}`);
                    await remove(messageRef);
                }
                
                console.log(`Supprimé ${toDelete.length} anciens messages`);
            }
        }
    } catch (error) {
        console.error("Erreur limitation messages:", error);
    }
}

// Modifiez la fonction pour charger les messages avec limitation
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
            
            // Afficher seulement les 100 derniers messages
            const recentMessages = messagesArray.slice(-MAX_MESSAGES_PER_ROOM);
            
            // Afficher chaque message
            recentMessages.forEach(message => {
                displayMessage(message);
            });
            
            // Mettre à jour le compteur
            updateMessageCounter(messagesArray.length);
            
            // Faire défiler vers le bas
            scrollToBottom();
        } else {
            updateMessageCounter(0);
        }
    });
}

// Fonction pour mettre à jour le compteur de messages
function updateMessageCounter(count) {
    const counter = document.getElementById('message-counter');
    if (counter) {
        counter.textContent = `${count}/${MAX_MESSAGES_PER_ROOM} messages`;
        
        // Changer la couleur si proche de la limite
        if (count > MAX_MESSAGES_PER_ROOM * 0.9) {
            counter.style.color = 'var(--danger)';
            counter.style.background = 'rgba(239, 68, 68, 0.1)';
        } else if (count > MAX_MESSAGES_PER_ROOM * 0.7) {
            counter.style.color = 'var(--warning)';
            counter.style.background = 'rgba(245, 158, 11, 0.1)';
        }
    }
}

// Modifiez la fonction d'affichage des messages pour gérer les types d'avatar
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
    
    // Déterminer l'URL de l'avatar selon le type
    const avatarType = message.avatarType || 'avataaars';
    let avatarUrl = `https://api.dicebear.com/7.x/${avatarType}/svg?seed=${message.avatar || 'User'}`;
    
    // Ajouter un fond coloré pour les avatars spéciaux
    const avatarColors = {
        'Robot': '6b7280',
        'Pixel': '3b82f6',
        'Thumb': '10b981'
    };
    
    if (avatarColors[message.avatar]) {
        avatarUrl += `&backgroundColor=${avatarColors[message.avatar]}`;
    } else if (avatarType === 'avataaars') {
        avatarUrl += '&backgroundColor=4f46e5';
    }
    
    messageElement.innerHTML = `
        <img src="${avatarUrl}" class="message-avatar" alt="${message.userName}">
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

// Modifiez l'écouteur pour la sélection d'avatar
document.querySelectorAll('#avatar-options img').forEach(img => {
    img.addEventListener('click', (e) => {
        const seed = e.target.getAttribute('data-seed');
        const type = e.target.getAttribute('data-type') || 'avataaars';
        
        currentUser.avatar = seed;
        currentUser.avatarType = type;
        
        // Mettre à jour l'avatar affiché
        const currentAvatarImg = document.getElementById('current-avatar');
        if (currentAvatarImg) {
            const avatarColors = {
                'Robot': '6b7280',
                'Pixel': '3b82f6',
                'Thumb': '10b981'
            };
            
            let avatarUrl = `https://api.dicebear.com/7.x/${type}/svg?seed=${seed}`;
            if (avatarColors[seed]) {
                avatarUrl += `&backgroundColor=${avatarColors[seed]}`;
            } else if (type === 'avataaars') {
                avatarUrl += '&backgroundColor=4f46e5';
            }
            
            currentAvatarImg.src = avatarUrl;
        }
        
        // Mettre à jour dans Firebase
        if (db && currentRoom) {
            const userRef = ref(db, `rooms/${currentRoom}/users/${currentUser.id}`);
            update(userRef, { 
                avatar: seed,
                avatarType: type 
            }).catch(error => {
                console.error("Erreur mise à jour avatar:", error);
            });
            
            const usersRef = ref(db, `users/${currentUser.id}`);
            update(usersRef, { 
                avatar: seed,
                avatarType: type 
            }).catch(error => {
                console.error("Erreur mise à jour avatar utilisateur:", error);
            });
        }
    });
});
