package com.casino.models;

import java.time.LocalDateTime;

/**
 * Modèle représentant une partie de jeu
 */
public class GameSession {
    private int sessionId;
    private int userId;
    private String gameType;
    private double betAmount;
    private double winAmount;
    private String gameData; // JSON avec les détails du jeu
    private LocalDateTime playedAt;
    private boolean isWin;

    // Types de jeux disponibles
    public static final String GAME_SLOTS = "SLOTS";
    public static final String GAME_ROULETTE = "ROULETTE";
    public static final String GAME_RACES = "RACES";

    // Constructeurs
    public GameSession() {}

    public GameSession(int userId, String gameType, double betAmount) {
        this.userId = userId;
        this.gameType = gameType;
        this.betAmount = betAmount;
        this.playedAt = LocalDateTime.now();
        this.winAmount = 0.0;
        this.isWin = false;
    }

    // Getters et Setters
    public int getSessionId() {
        return sessionId;
    }

    public void setSessionId(int sessionId) {
        this.sessionId = sessionId;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getGameType() {
        return gameType;
    }

    public void setGameType(String gameType) {
        this.gameType = gameType;
    }

    public double getBetAmount() {
        return betAmount;
    }

    public void setBetAmount(double betAmount) {
        this.betAmount = betAmount;
    }

    public double getWinAmount() {
        return winAmount;
    }

    public void setWinAmount(double winAmount) {
        this.winAmount = winAmount;
        this.isWin = winAmount > 0;
    }

    public String getGameData() {
        return gameData;
    }

    public void setGameData(String gameData) {
        this.gameData = gameData;
    }

    public LocalDateTime getPlayedAt() {
        return playedAt;
    }

    public void setPlayedAt(LocalDateTime playedAt) {
        this.playedAt = playedAt;
    }

    public boolean isWin() {
        return isWin;
    }

    public void setWin(boolean win) {
        isWin = win;
    }

    public double getNetAmount() {
        return winAmount - betAmount;
    }

    @Override
    public String toString() {
        return "GameSession{" +
                "sessionId=" + sessionId +
                ", userId=" + userId +
                ", gameType='" + gameType + '\'' +
                ", betAmount=" + betAmount +
                ", winAmount=" + winAmount +
                ", isWin=" + isWin +
                ", playedAt=" + playedAt +
                '}';
    }
}