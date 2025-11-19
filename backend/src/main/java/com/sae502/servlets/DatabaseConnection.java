package com.sae502.servlets;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Classe utilitaire qui centralise la connexion à la base SQLite du casino.
 * <p>
 * Le chemin de la base est construit à partir du {@code user.home},
 * ce qui évite de hardcoder le nom de l'utilisateur dans le chemin.
 * Le driver SQLite est chargé une fois dans un bloc statique.
 */
public class DatabaseConnection {

    /** Répertoire personnel de l'utilisateur courant (System.getProperty("user.home")). */
    static String userHome = System.getProperty("user.home");

    /** Chemin relatif du fichier de base de données dans le projet. */
    static String dbpath = userHome + "/IdeaProjects/Sae5.2/database/casino.db";

        /* MAC OS :
    private static final Path DB_PATH = Paths.get(
            System.getProperty("user.home"),
            "Desktop", "Sae5.2", "database", "casino.db"
    );
    */

    // Ancienne méthode avec chemin en dur :
    // private static final String DB_PATH = "C:/Users/Kinan/IdeaProjects/sae5.2/database/casino.db";

    /** URL JDBC complète vers la base SQLite. */
    static final String URL = "jdbc:sqlite:" + dbpath;

    static {
        try {
            // Chargement explicite du driver SQLite
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("SQLite JDBC Driver non trouvé", e);
        }
    }

    /**
     * Ouvre une nouvelle connexion JDBC vers la base du casino.
     *
     * @return une connexion prête à l'emploi
     * @throws SQLException si la connexion échoue (fichier introuvable, permissions, etc.)
     */
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL);
    }
}
