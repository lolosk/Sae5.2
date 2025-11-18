package com.sae502.servlets;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConnection {
    static String userHome = System.getProperty("user.home");
    static String dbpath = userHome + "/IdeaProjects/Sae5.2/database/casino.db";

        /* MAC OS :
    private static final Path DB_PATH = Paths.get(
            System.getProperty("user.home"),
            "Desktop", "Sae5.2", "database", "casino.db"
    );
    */
    // ancienne methode
    // private static final String DB_PATH = "C:/Users/Kinan/IdeaProjects/sae5.2/database/casino.db";

    // Windows :
    static final String URL = "jdbc:sqlite:" + dbpath;

    static {
        try {
            Class.forName("org.sqlite.JDBC"); // ✅ charge le driver manuellement
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("SQLite JDBC Driver non trouvé", e);
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL);
    }
}