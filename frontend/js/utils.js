// Utilitaires JavaScript pour le casino en ligne

/**
 * Fonctions utilitaires
 */
const Utils = {
    /**
     * Affiche un message d'alerte
     * @param {string} message - Le message à afficher
     * @param {string} type - Le type d'alerte (success, error, info)
     * @param {number} duration - Durée d'affichage en ms (défaut: 5000)
     */
    showAlert(message, type = 'info', duration = 5000) {
        const alertContainer = document.getElementById('alert-container');
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <strong>${type === 'error' ? 'Erreur!' : type === 'success' ? 'Succès!' : 'Info:'}</strong>
            ${message}
        `;
        
        alertContainer.appendChild(alert);
        
        // Supprimer l'alerte après la durée spécifiée
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, duration);
    },

    /**
     * Effectue une requête AJAX
     * @param {string} url - URL de la requête
     * @param {object} options - Options de la requête
     * @returns {Promise} Promesse de la réponse
     */
    async request(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, mergedOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('Erreur de requête:', error);
            throw error;
        }
    },

    /**
     * Convertit un objet en string de paramètres URL
     * @param {object} params - Objet des paramètres
     * @returns {string} String des paramètres URL
     */
    objectToUrlParams(params) {
        return Object.keys(params)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
            .join('&');
    },

    /**
     * Formate un montant en euros
     * @param {number} amount - Montant à formater
     * @returns {string} Montant formaté
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    },

    /**
     * Formate une date
     * @param {Date|string} date - Date à formater
     * @returns {string} Date formatée
     */
    formatDate(date) {
        const d = new Date(date);
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    },

    /**
     * Génère un nombre aléatoire entre min et max (inclus)
     * @param {number} min - Valeur minimale
     * @param {number} max - Valeur maximale
     * @returns {number} Nombre aléatoire
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Sélectionne un élément aléatoire dans un tableau
     * @param {Array} array - Tableau d'éléments
     * @returns {*} Élément sélectionné
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Anime un élément avec une classe CSS
     * @param {HTMLElement} element - Élément à animer
     * @param {string} animationClass - Classe d'animation
     * @param {number} duration - Durée de l'animation en ms
     */
    animate(element, animationClass, duration = 1000) {
        element.classList.add(animationClass);
        
        setTimeout(() => {
            element.classList.remove(animationClass);
        }, duration);
    },

    /**
     * Debounce une fonction
     * @param {Function} func - Fonction à debouncer
     * @param {number} wait - Temps d'attente en ms
     * @returns {Function} Fonction debouncée
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Vérifie si un élément est visible dans le viewport
     * @param {HTMLElement} element - Élément à vérifier
     * @returns {boolean} True si visible
     */
    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },

    /**
     * Stockage local avec gestion d'erreurs
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Erreur de stockage local:', error);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Erreur de lecture du stockage local:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Erreur de suppression du stockage local:', error);
                return false;
            }
        }
    },

    /**
     * Validation d'email
     * @param {string} email - Email à valider
     * @returns {boolean} True si valide
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validation de mot de passe
     * @param {string} password - Mot de passe à valider
     * @returns {object} Objet avec isValid et messages d'erreur
     */
    validatePassword(password) {
        const result = {
            isValid: true,
            errors: []
        };

        if (password.length < 6) {
            result.errors.push('Le mot de passe doit contenir au moins 6 caractères');
            result.isValid = false;
        }

        if (!/[a-zA-Z]/.test(password)) {
            result.errors.push('Le mot de passe doit contenir au moins une lettre');
            result.isValid = false;
        }

        return result;
    }
};

// Exportation pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}