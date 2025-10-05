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

    // Petit DTO interne
    public static class UserRow {
        public int id;
        public String username;
        public String passwordHash;
        public int credits;
    }
}
