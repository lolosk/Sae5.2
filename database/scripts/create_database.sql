-- Script de création de la base de données pour le casino en ligne
-- Projet Saé502 - BUT R&T

-- Création de la base de données
-- CREATE DATABASE casino_db;

-- Création de l'utilisateur (à exécuter en tant que superuser)
-- CREATE USER casino_user WITH PASSWORD 'casino_pass';
-- GRANT ALL PRIVILEGES ON DATABASE casino_db TO casino_user;

-- Connexion à la base casino_db avant d'exécuter les commandes suivantes

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Table des sessions de jeu
CREATE TABLE IF NOT EXISTS game_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('SLOTS', 'ROULETTE', 'RACES')),
    bet_amount DECIMAL(10,2) NOT NULL,
    win_amount DECIMAL(10,2) DEFAULT 0.00,
    game_data JSONB, -- Détails spécifiques au jeu (résultats, configuration, etc.)
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_win BOOLEAN DEFAULT false
);

-- Table pour les transactions de crédits
CREATE TABLE IF NOT EXISTS credit_transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'WIN', 'BET')),
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type ON game_sessions(game_type);
CREATE INDEX IF NOT EXISTS idx_game_sessions_played_at ON game_sessions(played_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Fonction pour enregistrer automatiquement les transactions de crédits
CREATE OR REPLACE FUNCTION log_credit_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Log des mises
    IF TG_OP = 'INSERT' THEN
        INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
        VALUES (NEW.user_id, 'BET', -NEW.bet_amount, 
                (SELECT credits FROM users WHERE user_id = NEW.user_id),
                'Mise pour ' || NEW.game_type);
        
        -- Log des gains si il y en a
        IF NEW.win_amount > 0 THEN
            INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
            VALUES (NEW.user_id, 'WIN', NEW.win_amount,
                    (SELECT credits FROM users WHERE user_id = NEW.user_id),
                    'Gain de ' || NEW.game_type);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour enregistrer les transactions automatiquement
DROP TRIGGER IF EXISTS trigger_log_credit_transaction ON game_sessions;
CREATE TRIGGER trigger_log_credit_transaction
    AFTER INSERT ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION log_credit_transaction();

-- Données de test (optionnel)
-- Utilisateur de test avec mot de passe "password123" (hash SHA-256)
INSERT INTO users (username, email, password_hash, credits) VALUES 
('testuser', 'test@casino.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 500.00)
ON CONFLICT (username) DO NOTHING;

-- Quelques sessions de jeu de test
INSERT INTO game_sessions (user_id, game_type, bet_amount, win_amount, is_win, game_data) VALUES 
(1, 'SLOTS', 10.00, 0.00, false, '{"symbols": ["🍒", "🍋", "⭐"], "lines": 1}'),
(1, 'ROULETTE', 25.00, 50.00, true, '{"bet_type": "red", "number": 18, "color": "red"}'),
(1, 'SLOTS', 5.00, 15.00, true, '{"symbols": ["🍒", "🍒", "🍒"], "lines": 1, "multiplier": 3}')
ON CONFLICT DO NOTHING;

-- Vues utiles pour les statistiques
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.user_id,
    u.username,
    u.credits,
    COUNT(gs.session_id) as total_games,
    COUNT(gs.session_id) FILTER (WHERE gs.is_win = true) as games_won,
    COALESCE(SUM(gs.bet_amount), 0) as total_bet,
    COALESCE(SUM(gs.win_amount), 0) as total_won,
    COALESCE(SUM(gs.win_amount) - SUM(gs.bet_amount), 0) as net_profit
FROM users u
LEFT JOIN game_sessions gs ON u.user_id = gs.user_id
WHERE u.is_active = true
GROUP BY u.user_id, u.username, u.credits;

-- Vue pour les statistiques par jeu
CREATE OR REPLACE VIEW game_stats AS
SELECT 
    game_type,
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE is_win = true) as wins,
    ROUND(COUNT(*) FILTER (WHERE is_win = true) * 100.0 / COUNT(*), 2) as win_rate,
    COALESCE(SUM(bet_amount), 0) as total_bet,
    COALESCE(SUM(win_amount), 0) as total_paid,
    ROUND(COALESCE(SUM(win_amount) / NULLIF(SUM(bet_amount), 0) * 100, 0), 2) as rtp_percentage
FROM game_sessions
GROUP BY game_type;

-- Accorder les permissions à l'utilisateur du casino
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO casino_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO casino_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO casino_user;