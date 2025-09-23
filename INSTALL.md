# Installation et Démarrage Rapide

## Prérequis
- Java 11+ 
- PostgreSQL 12+
- Maven 3.6+

## Installation en 3 étapes

### 1. Base de données
```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base et l'utilisateur
CREATE DATABASE casino_db;
CREATE USER casino_user WITH PASSWORD 'casino_pass';
GRANT ALL PRIVILEGES ON DATABASE casino_db TO casino_user;
\q

# Importer le schema
psql -U casino_user -d casino_db -f database/scripts/create_database.sql
```

### 2. Compilation
```bash
cd backend
mvn clean package
```

### 3. Déploiement
```bash
# Option A: Tomcat externe
cp target/casino.war $TOMCAT_HOME/webapps/

# Option B: Maven Tomcat plugin (développement)
mvn tomcat7:run
```

## Accès
- **URL**: http://localhost:8080/casino
- **Test user**: testuser / password123

## Structure finale du projet
```
Sae5.2/
├── backend/
│   ├── pom.xml                    # Configuration Maven
│   ├── src/main/java/com/casino/
│   │   ├── dao/UserDAO.java       # Accès données
│   │   ├── models/                # Entités métier
│   │   ├── servlets/AuthServlet.java  # API REST
│   │   └── utils/DatabaseManager.java # Connexions DB
│   ├── src/main/webapp/
│   │   ├── WEB-INF/web.xml       # Config serveur
│   │   ├── index.html            # Interface utilisateur
│   │   ├── css/style.css         # Styles
│   │   └── js/                   # Logic frontend
│   └── target/casino.war         # Package déployable
├── database/scripts/
│   └── create_database.sql       # Schema PostgreSQL
├── frontend/                     # Sources frontend
├── docs/                         # Documentation
└── README.md                     # Ce fichier
```

✅ **Projet entièrement fonctionnel et prêt pour la démonstration!**