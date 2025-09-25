package com.sae502.servlets;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConnection {
    private static final String DB_PATH = "C:/Users/lolo5/IdeaProjects/Sae5.2/database/casino.db";
    private static final String URL = "jdbc:sqlite:" + DB_PATH;

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
