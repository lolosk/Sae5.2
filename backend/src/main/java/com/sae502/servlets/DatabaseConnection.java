package com.sae502.servlets;

import java.nio.file.*;
import java.sql.*;

public class DatabaseConnection {
    private static final Path DB_PATH = Paths.get(
            System.getProperty("user.home"),
            "Desktop", "Sae5.2", "database", "casino.db"
    );
    private static final String URL = "jdbc:sqlite:" + DB_PATH;

    static {
        try { Class.forName("org.sqlite.JDBC"); }
        catch (ClassNotFoundException e) { throw new RuntimeException("SQLite JDBC Driver non trouvé", e); }

        if (!Files.exists(DB_PATH)) {
            throw new RuntimeException("Base SQLite introuvable : " + DB_PATH);
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL);
    }
}