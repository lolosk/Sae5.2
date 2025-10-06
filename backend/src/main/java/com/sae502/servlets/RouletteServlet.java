package com.sae502.servlets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.util.*;

@WebServlet(name = "RouletteServlet", urlPatterns = {"/roulette"})
public class RouletteServlet extends HttpServlet {

    enum Color { RED, BLACK, GREEN }

    private static final Set<Integer> REDS = Set.of(
            1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
    );

    private static Color colorOf(int number) {
        if (number == 0) return Color.GREEN;
        return REDS.contains(number) ? Color.RED : Color.BLACK;
    }

    enum BetType {
        STRAIGHT(35),
        RED(1), BLACK(1),
        EVEN(1), ODD(1),
        LOW(1), HIGH(1),
        DOZEN(2), COLUMN(2);

        final int payout;
        BetType(int payout) { this.payout = payout; }
    }

    static final class Bet {
        final BetType type;
        final BigDecimal amount;
        final Integer param;

        Bet(BetType type, BigDecimal amount, Integer param) {
            this.type = type;
            this.amount = amount;
            this.param = param;
        }

        boolean wins(int number, Color color) {
            switch (type) {
                case STRAIGHT: return Objects.equals(param, number);
                case RED: return color == Color.RED;
                case BLACK: return color == Color.BLACK;
                case EVEN: return number != 0 && number % 2 == 0;
                case ODD: return number % 2 == 1;
                case LOW: return number >= 1 && number <= 18;
                case HIGH: return number >= 19 && number <= 36;
                case DOZEN:
                    if (param == 1) return number >= 1 && number <= 12;
                    if (param == 2) return number >= 13 && number <= 24;
                    if (param == 3) return number >= 25 && number <= 36;
                    return false;
                case COLUMN:
                    if (number == 0) return false;
                    int col = ((number - 1) % 3) + 1;
                    return Objects.equals(param, col);
                default: return false;
            }
        }

        BigDecimal winAmount() {
            return amount.multiply(BigDecimal.valueOf(type.payout));
        }
    }

    // === Variables de jeu ===
    private final SecureRandom rng = new SecureRandom();
    private BigDecimal balance = new BigDecimal("1000.00");
    private final List<Bet> currentBets = new ArrayList<>();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/plain; charset=UTF-8");
        try (PrintWriter out = resp.getWriter()) {
            out.println("=== État de la roulette ===");
            out.println("Solde : " + balance + " €");
            out.println("Mises en cours : " + currentBets.size());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String action = req.getParameter("action");
        resp.setContentType("text/plain; charset=UTF-8");

        try (PrintWriter out = resp.getWriter()) {
            if (action == null) {
                out.println("Erreur : paramètre 'action' manquant (bet, spin, clear).");
                return;
            }

            switch (action) {
                case "bet":
                    handleBet(req, out);
                    break;
                case "spin":
                    handleSpin(out);
                    break;
                case "clear":
                    currentBets.clear();
                    out.println("Toutes les mises ont été effacées.");
                    break;
                default:
                    out.println("Action inconnue : " + action);
            }
        }
    }

    private void handleBet(HttpServletRequest req, PrintWriter out) {
        try {
            String typeStr = req.getParameter("type");
            String amountStr = req.getParameter("amount");
            String paramStr = req.getParameter("param");

            if (typeStr == null || amountStr == null) {
                out.println("Erreur : paramètres 'type' et 'amount' requis.");
                return;
            }

            BetType type = BetType.valueOf(typeStr.toUpperCase(Locale.ROOT));
            BigDecimal amount = new BigDecimal(amountStr).setScale(2, RoundingMode.HALF_UP);
            Integer param = (paramStr != null) ? Integer.parseInt(paramStr) : null;

            BigDecimal engaged = currentBets.stream()
                    .map(b -> b.amount)
                    .reduce(amount, BigDecimal::add);
            if (engaged.compareTo(balance) > 0) {
                out.println("Erreur : solde insuffisant pour cette mise.");
                return;
            }

            currentBets.add(new Bet(type, amount, param));
            out.println("✅ Mise ajoutée : " + type + " " + (param != null ? param : "") + " (" + amount + " €)");
        } catch (Exception e) {
            out.println("Erreur dans la mise : " + e.getMessage());
        }
    }

    private void handleSpin(PrintWriter out) {
        if (currentBets.isEmpty()) {
            out.println("Aucune mise en cours. Utilisez action=bet d'abord.");
            return;
        }

        BigDecimal stake = currentBets.stream()
                .map(b -> b.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        balance = balance.subtract(stake);

        int number = rng.nextInt(37);
        Color color = colorOf(number);

        BigDecimal credited = BigDecimal.ZERO;
        for (Bet b : currentBets) {
            if (b.wins(number, color)) {
                credited = credited.add(b.amount).add(b.winAmount());
            }
        }
        balance = balance.add(credited).setScale(2, RoundingMode.DOWN);

        out.printf("Résultat : %d (%s)%n", number, color);
        out.printf("Gain total : %s €%n", credited);
        out.printf("Nouveau solde : %s €%n", balance);
        currentBets.clear();
    }
}
