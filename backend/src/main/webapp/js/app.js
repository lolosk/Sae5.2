// Application principale du casino en ligne

/**
 * Application principale
 */
const App = {
    /**
     * Initialise l'application
     */
    init() {
        console.log('🎰 Initialisation du Casino en ligne...');
        
        // Vérifier que le DOM est chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.start();
            });
        } else {
            this.start();
        }
    },

    /**
     * Démarre l'application
     */
    start() {
        try {
            // Initialiser les modules
            Auth.init();
            
            // Configurer les événements globaux
            this.setupGlobalEvents();
            
            console.log('✅ Casino en ligne initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            Utils.showAlert('Erreur lors du chargement de l\'application', 'error');
        }
    },

    /**
     * Configure les événements globaux
     */
    setupGlobalEvents() {
        // Gestion des erreurs JavaScript globales
        window.addEventListener('error', (event) => {
            console.error('Erreur JavaScript:', event.error);
            // Ne pas afficher d'alerte en production pour éviter de spammer l'utilisateur
        });

        // Gestion des erreurs de promesses non catchées
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promesse rejetée non gérée:', event.reason);
        });

        // Gérer la fermeture de la page/onglet
        window.addEventListener('beforeunload', (event) => {
            // Vous pouvez ajouter ici du code pour sauvegarder des données
            // si nécessaire avant que l'utilisateur quitte la page
        });

        // Gestion de la perte de connexion réseau
        window.addEventListener('online', () => {
            Utils.showAlert('Connexion rétablie', 'success');
        });

        window.addEventListener('offline', () => {
            Utils.showAlert('Connexion perdue. Certaines fonctionnalités peuvent être indisponibles.', 'error');
        });
    }
};

// Initialiser l'application
App.init();