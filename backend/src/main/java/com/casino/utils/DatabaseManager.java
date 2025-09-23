package com.casino.utils;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import javax.servlet.ServletContext;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Gestionnaire de connexions à la base de données PostgreSQL
 */
public class DatabaseManager {
    private static HikariDataSource dataSource;
    private static volatile DatabaseManager instance;

    private DatabaseManager() {}

    public static DatabaseManager getInstance() {
        if (instance == null) {
            synchronized (DatabaseManager.class) {
                if (instance == null) {
                    instance = new DatabaseManager();
                }
            }
        }
        return instance;
    }

    /**
     * Initialise la source de données avec les paramètres du contexte
     */
    public void initialize(ServletContext context) {
        if (dataSource == null) {
            HikariConfig config = new HikariConfig();
            
            String url = context.getInitParameter("DB_URL");
            String username = context.getInitParameter("DB_USER");
            String password = context.getInitParameter("DB_PASSWORD");
            
            config.setJdbcUrl(url != null ? url : "jdbc:postgresql://localhost:5432/casino_db");
            config.setUsername(username != null ? username : "casino_user");
            config.setPassword(password != null ? password : "casino_pass");
            
            // Configuration du pool de connexions
            config.setMaximumPoolSize(10);
            config.setMinimumIdle(2);
            config.setIdleTimeout(30000);
            config.setConnectionTimeout(20000);
            config.setLeakDetectionThreshold(60000);
            
            // Paramètres PostgreSQL
            config.addDataSourceProperty("cachePrepStmts", "true");
            config.addDataSourceProperty("prepStmtCacheSize", "250");
            config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
            
            dataSource = new HikariDataSource(config);
        }
    }

    /**
     * Obtient une connexion à la base de données
     */
    public Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("DataSource not initialized. Call initialize() first.");
        }
        return dataSource.getConnection();
    }

    /**
     * Ferme le pool de connexions
     */
    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }

    /**
     * Vérifie si la base de données est accessible
     */
    public boolean isHealthy() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (SQLException e) {
            return false;
        }
    }
}