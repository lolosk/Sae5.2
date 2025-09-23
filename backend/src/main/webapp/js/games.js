// Gestion des jeux du casino

const Games = {
    /**
     * Initialise le système de jeux
     */
    init() {
        this.setupGameEventListeners();
    },

    /**
     * Configure les écouteurs d'événements pour les jeux
     */
    setupGameEventListeners() {
        const gameCards = document.querySelectorAll('.game-card');
        
        gameCards.forEach(card => {
            const gameButton = card.querySelector('.btn-game');
            if (gameButton) {
                gameButton.addEventListener('click', () => {
                    const gameType = card.dataset.game;
                    this.startGame(gameType);
                });
            }
        });
    },

    /**
     * Démarre un jeu
     */
    startGame(gameType) {
        if (!Auth.isAuthenticated) {
            Utils.showAlert('Vous devez être connecté pour jouer', 'error');
            return;
        }

        const gameArea = document.getElementById('game-area');
        if (!gameArea) return;

        gameArea.innerHTML = '';
        gameArea.classList.remove('hidden');

        switch (gameType) {
            case 'slots':
                this.initSlotMachine(gameArea);
                break;
            case 'roulette':
                this.initRoulette(gameArea);
                break;
            case 'races':
                this.initRaces(gameArea);
                break;
            default:
                Utils.showAlert('Jeu non disponible', 'error');
        }
    },

    /**
     * Initialise la machine à sous
     */
    initSlotMachine(container) {
        container.innerHTML = `
            <div class="game-header">
                <h2>🎰 Machine à Sous</h2>
                <button class="btn btn-logout" onclick="Games.closeGame()">Retour</button>
            </div>
            <div class="slot-machine">
                <div class="slot-reels">
                    <div class="slot-reel" id="reel1">🍒</div>
                    <div class="slot-reel" id="reel2">🍋</div>
                    <div class="slot-reel" id="reel3">⭐</div>
                </div>
                <div class="slot-controls">
                    <div class="bet-controls">
                        <label for="slot-bet">Mise:</label>
                        <select id="slot-bet">
                            <option value="1">1€</option>
                            <option value="5">5€</option>
                            <option value="10">10€</option>
                            <option value="25">25€</option>
                        </select>
                    </div>
                    <button id="spin-button" class="btn btn-game">SPIN</button>
                </div>
                <div class="slot-result" id="slot-result"></div>
            </div>
        `;

        // Ajouter les styles pour les slots
        const style = document.createElement('style');
        style.textContent = `
            .slot-machine { text-align: center; padding: 2rem; }
            .slot-reels { display: flex; justify-content: center; gap: 1rem; margin: 2rem 0; }
            .slot-reel { 
                font-size: 4rem; 
                background: #f8f9fa; 
                border: 3px solid #2a5298; 
                border-radius: 10px; 
                padding: 1rem; 
                width: 100px; 
                height: 100px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                transition: all 0.3s ease;
            }
            .slot-controls { margin: 2rem 0; }
            .bet-controls { margin-bottom: 1rem; }
            .slot-result { font-size: 1.2rem; font-weight: bold; margin-top: 1rem; }
            .game-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        `;
        document.head.appendChild(style);

        // Configurer les événements
        const spinButton = document.getElementById('spin-button');
        spinButton.addEventListener('click', () => this.spinSlots());
    },

    /**
     * Lance les rouleaux de la machine à sous
     */
    spinSlots() {
        const betSelect = document.getElementById('slot-bet');
        const betAmount = parseFloat(betSelect.value);
        const resultDiv = document.getElementById('slot-result');
        const spinButton = document.getElementById('spin-button');

        // Vérifier les crédits
        if (!Auth.hasEnoughCredits(betAmount)) {
            Utils.showAlert('Crédits insuffisants', 'error');
            return;
        }

        // Désactiver le bouton pendant l'animation
        spinButton.disabled = true;
        resultDiv.textContent = '';

        // Symboles possibles
        const symbols = ['🍒', '🍋', '⭐', '🍊', '🍇', '💎', '🔔'];
        
        // Animation des rouleaux
        const reels = ['reel1', 'reel2', 'reel3'];
        const finalSymbols = [];

        reels.forEach((reelId, index) => {
            const reel = document.getElementById(reelId);
            let spinCount = 0;
            const maxSpins = 20 + (index * 5); // Chaque rouleau s'arrête à un moment différent

            const spinInterval = setInterval(() => {
                reel.textContent = Utils.randomChoice(symbols);
                spinCount++;

                if (spinCount >= maxSpins) {
                    clearInterval(spinInterval);
                    const finalSymbol = Utils.randomChoice(symbols);
                    reel.textContent = finalSymbol;
                    finalSymbols.push(finalSymbol);

                    // Vérifier si tous les rouleaux sont arrêtés
                    if (finalSymbols.length === 3) {
                        this.evaluateSlotResult(finalSymbols, betAmount);
                        spinButton.disabled = false;
                    }
                }
            }, 100);
        });
    },

    /**
     * Évalue le résultat de la machine à sous
     */
    evaluateSlotResult(symbols, betAmount) {
        const resultDiv = document.getElementById('slot-result');
        let winAmount = 0;
        let message = '';

        // Logique des gains
        if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
            // Trois symboles identiques
            const multipliers = {
                '💎': 50,
                '🔔': 25,
                '⭐': 15,
                '🍒': 10,
                '🍇': 8,
                '🍊': 6,
                '🍋': 5
            };
            
            const multiplier = multipliers[symbols[0]] || 3;
            winAmount = betAmount * multiplier;
            message = `🎉 JACKPOT! Trois ${symbols[0]}! Vous gagnez ${winAmount.toFixed(2)}€!`;
        } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
            // Deux symboles identiques
            winAmount = betAmount * 2;
            message = `🎊 Paire! Vous gagnez ${winAmount.toFixed(2)}€!`;
        } else {
            message = `😔 Perdu! Tentez votre chance à nouveau!`;
        }

        // Mettre à jour les crédits
        const newCredits = Auth.getCurrentCredits() - betAmount + winAmount;
        Auth.updateCredits(newCredits);

        resultDiv.innerHTML = message;
        
        if (winAmount > 0) {
            Utils.showAlert(message, 'success');
        }
    },

    /**
     * Initialise la roulette (version simplifiée)
     */
    initRoulette(container) {
        container.innerHTML = `
            <div class="game-header">
                <h2>🎡 Roulette</h2>
                <button class="btn btn-logout" onclick="Games.closeGame()">Retour</button>
            </div>
            <div class="roulette-game">
                <div class="roulette-wheel">
                    <div class="roulette-number" id="roulette-result">?</div>
                </div>
                <div class="roulette-bets">
                    <div class="bet-type">
                        <h3>Choisissez votre mise:</h3>
                        <div class="bet-options">
                            <button class="bet-btn" data-type="red">Rouge (x2)</button>
                            <button class="bet-btn" data-type="black">Noir (x2)</button>
                            <button class="bet-btn" data-type="even">Pair (x2)</button>
                            <button class="bet-btn" data-type="odd">Impair (x2)</button>
                        </div>
                    </div>
                    <div class="bet-amount">
                        <label for="roulette-bet">Montant:</label>
                        <select id="roulette-bet">
                            <option value="5">5€</option>
                            <option value="10">10€</option>
                            <option value="25">25€</option>
                            <option value="50">50€</option>
                        </select>
                        <button id="roulette-spin" class="btn btn-game" disabled>LANCER</button>
                    </div>
                </div>
                <div id="roulette-result-text" class="game-result"></div>
            </div>
        `;

        // Ajouter les styles pour la roulette
        const style = document.createElement('style');
        style.textContent = `
            .roulette-game { text-align: center; padding: 2rem; }
            .roulette-wheel { margin: 2rem auto; }
            .roulette-number { 
                font-size: 4rem; 
                background: #2a5298; 
                color: white; 
                border-radius: 50%; 
                width: 150px; 
                height: 150px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                margin: 0 auto;
                border: 5px solid #ffd700;
            }
            .bet-options { display: flex; gap: 1rem; justify-content: center; margin: 1rem 0; flex-wrap: wrap; }
            .bet-btn { 
                padding: 0.75rem 1.5rem; 
                border: 2px solid #2a5298; 
                background: white; 
                color: #2a5298; 
                border-radius: 5px; 
                cursor: pointer; 
                transition: all 0.3s ease;
            }
            .bet-btn:hover { background: #2a5298; color: white; }
            .bet-btn.selected { background: #ffd700; color: #333; border-color: #ffd700; }
            .bet-amount { margin: 2rem 0; }
            .game-result { font-size: 1.2rem; font-weight: bold; margin-top: 1rem; }
        `;
        document.head.appendChild(style);

        this.setupRouletteEvents();
    },

    /**
     * Configure les événements de la roulette
     */
    setupRouletteEvents() {
        const betButtons = document.querySelectorAll('.bet-btn');
        const spinButton = document.getElementById('roulette-spin');
        let selectedBet = null;

        betButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                betButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedBet = btn.dataset.type;
                spinButton.disabled = false;
            });
        });

        spinButton.addEventListener('click', () => {
            if (selectedBet) {
                this.spinRoulette(selectedBet);
            }
        });
    },

    /**
     * Lance la roulette
     */
    spinRoulette(betType) {
        const betSelect = document.getElementById('roulette-bet');
        const betAmount = parseFloat(betSelect.value);
        const resultDiv = document.getElementById('roulette-result-text');
        const numberDiv = document.getElementById('roulette-result');
        const spinButton = document.getElementById('roulette-spin');

        if (!Auth.hasEnoughCredits(betAmount)) {
            Utils.showAlert('Crédits insuffisants', 'error');
            return;
        }

        spinButton.disabled = true;
        resultDiv.textContent = '';

        // Animation de la roulette
        let spinCount = 0;
        const spinInterval = setInterval(() => {
            numberDiv.textContent = Utils.randomInt(0, 36);
            spinCount++;

            if (spinCount >= 20) {
                clearInterval(spinInterval);
                const finalNumber = Utils.randomInt(0, 36);
                numberDiv.textContent = finalNumber;
                this.evaluateRouletteResult(finalNumber, betType, betAmount);
                spinButton.disabled = false;
            }
        }, 100);
    },

    /**
     * Évalue le résultat de la roulette
     */
    evaluateRouletteResult(number, betType, betAmount) {
        const resultDiv = document.getElementById('roulette-result-text');
        let won = false;
        let winAmount = 0;

        // Déterminer si le pari est gagnant
        switch (betType) {
            case 'red':
                const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                won = redNumbers.includes(number);
                break;
            case 'black':
                const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
                won = blackNumbers.includes(number);
                break;
            case 'even':
                won = number !== 0 && number % 2 === 0;
                break;
            case 'odd':
                won = number % 2 === 1;
                break;
        }

        if (won) {
            winAmount = betAmount * 2;
            resultDiv.innerHTML = `🎉 Numéro ${number} - Vous avez gagné ${winAmount.toFixed(2)}€!`;
            Utils.showAlert(`Gagné! ${winAmount.toFixed(2)}€`, 'success');
        } else {
            resultDiv.innerHTML = `😔 Numéro ${number} - Perdu!`;
        }

        // Mettre à jour les crédits
        const newCredits = Auth.getCurrentCredits() - betAmount + winAmount;
        Auth.updateCredits(newCredits);
    },

    /**
     * Initialise les courses (version basique)
     */
    initRaces(container) {
        container.innerHTML = `
            <div class="game-header">
                <h2>🏇 Courses</h2>
                <button class="btn btn-logout" onclick="Games.closeGame()">Retour</button>
            </div>
            <div class="races-game">
                <p>Ce jeu sera bientôt disponible!</p>
                <p>Restez connecté pour découvrir les courses de chevaux.</p>
            </div>
        `;
    },

    /**
     * Ferme le jeu en cours
     */
    closeGame() {
        const gameArea = document.getElementById('game-area');
        if (gameArea) {
            gameArea.classList.add('hidden');
            gameArea.innerHTML = '';
        }
    }
};