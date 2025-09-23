# 🎰 Casino en ligne (Saé502 - BUT R&T)

Projet scolaire en Java (backend) + HTML/CSS/JS (frontend) avec base PostgreSQL.  
Ce projet simule un mini-casino en ligne avec login, gestion des crédits et plusieurs jeux (machine à sous, roulette, courses).

## 🚀 Stack technique
- Backend : Java (Tomcat + Servlets, WebSockets)
- Frontend : HTML / CSS / JS
- Base de données : PostgreSQL
- Gestion projet : GitHub (issues, branches, pull requests)

## 📂 Structure
- `backend/` → code Java (serveur, logique métier, DAO)
- `frontend/` → pages HTML/CSS/JS
- `database/` → scripts SQL (tables, inserts)
- `docs/` → UML, Gantt, rapport

## 🌿 Branches Git
- `main` → stable
- `dev` → intégration
- `feature-*` → nouvelles fonctionnalités

## 👥 Membres du groupe
- Alice — Authentification & BDD
- Bob — Jeux (roulette, machine à sous)
- Charlie — Frontend & intégration

## 📅 Planning
Voir le Gantt dans `docs/`.

## 🚀 Guide de démarrage

### Prérequis
- Java 11 ou supérieur
- Maven 3.6+
- PostgreSQL 12+
- Tomcat 9.0+

### Configuration de la base de données
1. Installer PostgreSQL
2. Créer la base de données :
```sql
CREATE DATABASE casino_db;
CREATE USER casino_user WITH PASSWORD 'casino_pass';
GRANT ALL PRIVILEGES ON DATABASE casino_db TO casino_user;
```

3. Exécuter le script de création :
```bash
psql -U casino_user -d casino_db -f database/scripts/create_database.sql
```

### Compilation et déploiement
1. Compiler le projet :
```bash
cd backend
mvn clean compile
```

2. Créer le package WAR :
```bash
mvn clean package
```

3. Déployer sur Tomcat :
   - Copier `backend/target/casino.war` dans le dossier `webapps` de Tomcat
   - Ou utiliser Maven Tomcat plugin : `mvn tomcat7:run`

### Accès
- URL : http://localhost:8080/casino
- Compte de test : testuser / password123

## ✨ Fonctionnalités

- ✅ Authentification (connexion/inscription)
- ✅ Gestion des crédits
- ✅ Machine à sous
- ✅ Roulette simplifiée
- ⏳ Courses (à venir)
- ✅ Historique des parties
- ✅ Interface responsive

---
