// Gestion de l'authentification pour le casino en ligne

const Auth = {
    currentUser: null,
    isAuthenticated: false,

    /**
     * Initialise le système d'authentification
     */
    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    },

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Onglets de connexion/inscription
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (loginTab && registerTab) {
            loginTab.addEventListener('click', () => {
                this.switchTab('login');
            });

            registerTab.addEventListener('click', () => {
                this.switchTab('register');
            });
        }

        // Formulaires
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e.target);
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister(e.target);
            });
        }
    },

    /**
     * Change d'onglet entre connexion et inscription
     */
    switchTab(tab) {
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        }
    },

    /**
     * Vérifie le statut d'authentification au chargement
     */
    async checkAuthStatus() {
        try {
            const response = await Utils.request('/casino/auth');
            
            if (response.authenticated) {
                this.currentUser = {
                    username: response.username,
                    credits: response.credits
                };
                this.isAuthenticated = true;
                this.showGamesSection();
            } else {
                this.showLoginSection();
            }
        } catch (error) {
            console.error('Erreur lors de la vérification du statut:', error);
            this.showLoginSection();
        }
    },

    /**
     * Gère la connexion
     */
    async handleLogin(form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');

        if (!username || !password) {
            Utils.showAlert('Veuillez remplir tous les champs', 'error');
            return;
        }

        try {
            const params = Utils.objectToUrlParams({
                action: 'login',
                username: username,
                password: password
            });

            const response = await Utils.request('/casino/auth', {
                method: 'POST',
                body: params
            });

            if (response.success) {
                this.currentUser = {
                    username: response.username,
                    credits: response.credits
                };
                this.isAuthenticated = true;
                
                Utils.showAlert(`Bienvenue ${response.username}!`, 'success');
                this.showGamesSection();
                
                // Réinitialiser le formulaire
                form.reset();
            } else {
                Utils.showAlert(response.message || 'Erreur de connexion', 'error');
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            Utils.showAlert('Erreur de connexion au serveur', 'error');
        }
    },

    /**
     * Gère l'inscription
     */
    async handleRegister(form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const email = formData.get('email');
        const password = formData.get('password');

        // Validation côté client
        if (!username || !email || !password) {
            Utils.showAlert('Veuillez remplir tous les champs', 'error');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.showAlert('Veuillez entrer une adresse email valide', 'error');
            return;
        }

        const passwordValidation = Utils.validatePassword(password);
        if (!passwordValidation.isValid) {
            Utils.showAlert(passwordValidation.errors.join('<br>'), 'error');
            return;
        }

        try {
            const params = Utils.objectToUrlParams({
                action: 'register',
                username: username,
                email: email,
                password: password
            });

            const response = await Utils.request('/casino/auth', {
                method: 'POST',
                body: params
            });

            if (response.success) {
                this.currentUser = {
                    username: response.username,
                    credits: response.credits
                };
                this.isAuthenticated = true;
                
                Utils.showAlert(`Inscription réussie! Bienvenue ${response.username}!`, 'success');
                this.showGamesSection();
                
                // Réinitialiser le formulaire
                form.reset();
            } else {
                Utils.showAlert(response.message || 'Erreur d\'inscription', 'error');
            }
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            Utils.showAlert('Erreur de connexion au serveur', 'error');
        }
    },

    /**
     * Gère la déconnexion
     */
    async logout() {
        try {
            const params = Utils.objectToUrlParams({
                action: 'logout'
            });

            const response = await Utils.request('/casino/auth', {
                method: 'POST',
                body: params
            });

            if (response.success) {
                this.currentUser = null;
                this.isAuthenticated = false;
                
                Utils.showAlert('Déconnexion réussie', 'success');
                this.showLoginSection();
            }
        } catch (error) {
            console.error('Erreur de déconnexion:', error);
            // Déconnecter localement même en cas d'erreur
            this.currentUser = null;
            this.isAuthenticated = false;
            this.showLoginSection();
            Utils.showAlert('Déconnexion effectuée', 'info');
        }
    },

    /**
     * Affiche la section de connexion
     */
    showLoginSection() {
        const loginSection = document.getElementById('login-section');
        const gamesSection = document.getElementById('games-section');
        const authSection = document.getElementById('auth-section');

        if (loginSection) loginSection.classList.remove('hidden');
        if (gamesSection) gamesSection.classList.add('hidden');
        
        // Mettre à jour la section d'authentification dans le header
        if (authSection) {
            authSection.innerHTML = '';
        }
    },

    /**
     * Affiche la section des jeux
     */
    showGamesSection() {
        const loginSection = document.getElementById('login-section');
        const gamesSection = document.getElementById('games-section');
        const authSection = document.getElementById('auth-section');

        if (loginSection) loginSection.classList.add('hidden');
        if (gamesSection) gamesSection.classList.remove('hidden');
        
        // Mettre à jour les informations utilisateur
        this.updateUserInfo();
        
        // Mettre à jour la section d'authentification dans le header
        if (authSection) {
            authSection.innerHTML = `
                <span class="user-welcome">Bienvenue, ${this.currentUser.username}</span>
                <button class="btn btn-logout" onclick="Auth.logout()">Déconnexion</button>
            `;
        }
    },

    /**
     * Met à jour les informations utilisateur affichées
     */
    updateUserInfo() {
        const userNameElement = document.getElementById('user-name');
        const userCreditsElement = document.getElementById('user-credits');

        if (userNameElement && this.currentUser) {
            userNameElement.textContent = this.currentUser.username;
        }

        if (userCreditsElement && this.currentUser) {
            userCreditsElement.textContent = this.currentUser.credits.toFixed(2);
        }
    },

    /**
     * Met à jour les crédits de l'utilisateur
     */
    updateCredits(newCredits) {
        if (this.currentUser) {
            this.currentUser.credits = newCredits;
            this.updateUserInfo();
        }
    },

    /**
     * Vérifie si l'utilisateur a suffisamment de crédits
     */
    hasEnoughCredits(amount) {
        return this.currentUser && this.currentUser.credits >= amount;
    },

    /**
     * Obtient les crédits actuels de l'utilisateur
     */
    getCurrentCredits() {
        return this.currentUser ? this.currentUser.credits : 0;
    },

    /**
     * Obtient le nom d'utilisateur actuel
     */
    getCurrentUsername() {
        return this.currentUser ? this.currentUser.username : null;
    }
};