package com.sae502.servlets;

import java.sql.*;
import org.mindrot.jbcrypt.BCrypt;

public class UserDao {

    // Récupère un utilisateur par username (id + credits, utile après login)
    public static UserRow getByUsername(String username) throws SQLException {
        final String sql = "SELECT id, username, password_hash, credits FROM users WHERE username = ?";
        try (Connection cn = DatabaseConnection.getConnection();
             PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                UserRow u = new UserRow();
                u.id = rs.getInt("id");
                u.username = rs.getString("username");
                u.passwordHash = rs.getString("password_hash");
                u.credits = rs.getInt("credits");
                return u;
            }
        }
    }

    public static UserRow authenticateBCrypt(String username, String password) throws SQLException {
        UserRow u = getByUsername(username);
        if (u == null || u.passwordHash == null) return null;

        // Cas 1 — hash BCrypt valide
        if (u.passwordHash.startsWith("$2a$") || u.passwordHash.startsWith("$2b$") || u.passwordHash.startsWith("$2y$")) {
            return org.mindrot.jbcrypt.BCrypt.checkpw(password, u.passwordHash) ? u : null;
        }

        // Cas 2 — Legacy: password_hash contient en fait un mot de passe en clair
        if (password.equals(u.passwordHash)) {
            // Upgrade automatique en BCrypt
            String newHash = org.mindrot.jbcrypt.BCrypt.hashpw(password, org.mindrot.jbcrypt.BCrypt.gensalt(12));
            final String up = "UPDATE users SET password_hash = ? WHERE id = ?";
            try (Connection cn = DatabaseConnection.getConnection();
                 PreparedStatement ps = cn.prepareStatement(up)) {
                ps.setString(1, newHash);
                ps.setInt(2, u.id);
                ps.executeUpdate();
            }
            u.passwordHash = newHash;
            return u;
        }

        // Sinon, mauvais mdp
        return null;
    }



    // Vérifie le mot de passe (BCrypt)
    public static boolean checkUserPasswordBCrypt(String username, String password) throws SQLException {
        UserRow u = getByUsername(username);
        return u != null && u.passwordHash != null && BCrypt.checkpw(password, u.passwordHash);
    }

    // Crée un utilisateur (hash BCrypt)
    public static boolean createUserBCrypt(String username, String password) throws SQLException {
        final String sql = "INSERT INTO users(username, password_hash) VALUES(?, ?)";
        final String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));
        try (Connection cn = DatabaseConnection.getConnection();
             PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setString(1, username);
            ps.setString(2, hash);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            // SQLite renvoie code 19 pour contrainte UNIQUE
            // On renvoie false si le username existe déjà
            final String msg = (e.getMessage() == null) ? "" : e.getMessage().toLowerCase();
            if (msg.contains("unique") || msg.contains("constraint") || msg.contains("users.username")) {
                return false;
            }
            throw e;
        }
    }

    // ==== Roulette (stockage des mises) =========================================
    public static class RouletteBet {
        public final String type;     // STRAIGHT / DOZEN / COLUMN / RED / BLACK / EVEN / ODD / LOW / HIGH
        public final int amount;      // crédits engagés
        public final Integer param;   // STRAIGHT: 0..36, DOZEN:1..3, COLUMN:1..3, autres: null

        public RouletteBet(String type, int amount, Integer param){
            this.type  = type;
            this.amount = amount;
            this.param = param;
        }
    }

    /** Liste les mises en cours d’un joueur (ordre d’insertion). */
    public static java.util.List<RouletteBet> rouletteListBets(int userId) throws java.sql.SQLException {
        try (java.sql.Connection c = DatabaseConnection.getConnection();
             java.sql.PreparedStatement ps = c.prepareStatement(
                     "SELECT type, amount, param FROM roulette_bets WHERE user_id=? ORDER BY id ASC")) {

            ps.setInt(1, userId);

            try (java.sql.ResultSet rs = ps.executeQuery()) {
                java.util.List<RouletteBet> out = new java.util.ArrayList<>();
                while (rs.next()) {
                    out.add(new RouletteBet(
                            rs.getString(1),
                            rs.getInt(2),
                            (Integer) rs.getObject(3)
                    ));
                }
                return out;
            }
        }
    }

    /** Ajoute UNE mise. (Le débit des crédits se fait côté servlet avant cet appel.) */
    public static void rouletteAddBet(int userId, String type, int amount, Integer param) throws java.sql.SQLException {
        try (java.sql.Connection c = DatabaseConnection.getConnection();
             java.sql.PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO roulette_bets(user_id,type,amount,param,created_at) " +
                             "VALUES(?,?,?,?,CURRENT_TIMESTAMP)")) {

            ps.setInt(1, userId);
            ps.setString(2, type);
            ps.setInt(3, amount);
            if (param == null) ps.setNull(4, java.sql.Types.INTEGER);
            else               ps.setInt(4, param);
            ps.executeUpdate();
        }
    }

    /** Supprime toutes les mises du joueur et renvoie le total à rembourser (somme des amounts). */
    public static int rouletteClearAndRefundTotal(int userId) throws java.sql.SQLException {
        try (java.sql.Connection c = DatabaseConnection.getConnection()) {
            c.setAutoCommit(false);
            int total = 0;

            try (java.sql.PreparedStatement ps = c.prepareStatement(
                    "SELECT COALESCE(SUM(amount),0) FROM roulette_bets WHERE user_id=?")) {
                ps.setInt(1, userId);
                try (java.sql.ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) total = rs.getInt(1);
                }
            }

            try (java.sql.PreparedStatement del = c.prepareStatement(
                    "DELETE FROM roulette_bets WHERE user_id=?")) {
                del.setInt(1, userId);
                del.executeUpdate();
            }

            c.commit();
            return total;
        }
    }


    // --- Crédits & logs de parties communs à tous les jeux ----------------------

    /** Met à jour les crédits d'un utilisateur (valeur absolue). */
    public static void updateCredits(int userId, int newCredits) throws SQLException {
        final String sql = "UPDATE users SET credits = ? WHERE id = ?";
        try (Connection cn = DatabaseConnection.getConnection();
             PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setInt(1, newCredits);
            ps.setInt(2, userId);
            ps.executeUpdate();
        }
    }

    /** Insère une ligne d'historique dans la table games.
     *  resultJson est un JSON (stocké en TEXT sous SQLite).
     *  La colonne created_at est remplie automatiquement.
     */
    public static void insertGameLog(int userId, String gameType, int bet, String resultJson) throws SQLException {
        final String sql = "INSERT INTO games(user_id, game_type, bet, result, created_at) " +
                "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection cn = DatabaseConnection.getConnection();
             PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setString(2, gameType);
            ps.setInt(3, bet);
            ps.setString(4, resultJson);
            ps.executeUpdate();
        }
    }

    /** Renvoie le nouveau solde si le débit passe, sinon null (fonds insuffisants). */
    public static Integer debitCreditsIfEnough(int userId, int amount) throws SQLException {
        if (amount <= 0) return getCredits(userId);
        try (Connection c = DatabaseConnection.getConnection()) {
            c.setAutoCommit(false);
            try (PreparedStatement up = c.prepareStatement(
                    "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?")) {
                up.setInt(1, amount);
                up.setInt(2, userId);
                up.setInt(3, amount);
                int updated = up.executeUpdate();
                if (updated == 0) {
                    c.rollback();
                    return null; // pas assez de crédits
                }
            }
            int credits = getCreditsTx(c, userId);
            c.commit();
            return credits;
        }
    }

    public static int addCredits(int userId, int amount) throws SQLException {
        if (amount <= 0) return getCredits(userId);
        try (Connection c = DatabaseConnection.getConnection()) {
            c.setAutoCommit(false);
            try (PreparedStatement up = c.prepareStatement(
                    "UPDATE users SET credits = credits + ? WHERE id = ?")) {
                up.setInt(1, amount);
                up.setInt(2, userId);
                up.executeUpdate();
            }
            int credits = getCreditsTx(c, userId);
            c.commit();
            return credits;
        }
    }

    // Helpers
    private static int getCreditsTx(Connection c, int userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT credits FROM users WHERE id = ?")) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    public static int getCredits(int userId) throws SQLException {
        try (Connection c = DatabaseConnection.getConnection()) {
            return getCreditsTx(c, userId);
        }
    }


    // Petit DTO interne
    public static class UserRow {
        public int id;
        public String username;
        public String passwordHash;
        public int credits;
    }
}
