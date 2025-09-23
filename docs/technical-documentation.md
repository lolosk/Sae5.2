# Documentation Technique - Casino en ligne

## Architecture

### Backend (Java)
- **Servlets** : Gestion des requêtes HTTP
- **DAO** : Accès aux données PostgreSQL  
- **Models** : Représentation des entités (User, GameSession)
- **Utils** : Classes utilitaires (DatabaseManager)

### Frontend (HTML/CSS/JS)
- **HTML** : Structure des pages
- **CSS** : Styles et animations
- **JavaScript** : Logique côté client, AJAX

### Base de données (PostgreSQL)
- **users** : Comptes utilisateurs
- **game_sessions** : Historique des parties
- **credit_transactions** : Mouvements de crédits

## API REST

### Authentification (`/auth`)
- `GET` : Vérifier le statut de connexion
- `POST action=login` : Connexion utilisateur
- `POST action=register` : Inscription utilisateur  
- `POST action=logout` : Déconnexion

### Réponses JSON
```json
{
  "success": true/false,
  "message": "Description",
  "data": {...}
}
```

## Sécurité

- Mots de passe hachés en SHA-256
- Sessions HTTP sécurisées
- Validation côté client et serveur
- Protection CSRF (sessions)

## Base de données

### Table users
```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

### Table game_sessions
```sql
CREATE TABLE game_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    game_type VARCHAR(20) CHECK (game_type IN ('SLOTS', 'ROULETTE', 'RACES')),
    bet_amount DECIMAL(10,2) NOT NULL,
    win_amount DECIMAL(10,2) DEFAULT 0.00,
    game_data JSONB,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_win BOOLEAN DEFAULT false
);
```

## Jeux implémentés

### Machine à sous
- 3 rouleaux avec symboles
- Multiplicateurs variables selon les symboles
- Animation des rouleaux

### Roulette
- Paris simples (rouge/noir, pair/impair)
- Gains x2 sur les paris simples
- Animation de la roue

### Courses (à venir)
- Paris sur des chevaux
- Système de cotes
- Animation de course

## Tests

### Tests unitaires
```bash
cd backend
mvn test
```

### Tests d'intégration
- Tester l'authentification
- Tester les jeux
- Tester la base de données

## Déploiement

### Environnement de développement
```bash
mvn tomcat7:run
```

### Production
1. Compiler : `mvn clean package`
2. Déployer le WAR sur Tomcat
3. Configurer PostgreSQL
4. Exécuter les scripts SQL

## Monitoring

### Logs
- Logs applicatifs dans `/var/log/tomcat`
- Logs PostgreSQL pour la base

### Métriques
- Connexions actives
- Parties jouées par heure
- RTP (Return to Player) par jeu