package com.sae502.servlets;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.SQLException;
import java.util.concurrent.ThreadLocalRandom;

@WebServlet(urlPatterns = "/api/roulette/spin")
public class RouletteServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        // Session / user
        HttpSession s = req.getSession(false);
        if (s == null || s.getAttribute("user") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
            return;
        }
        String username = (String) s.getAttribute("user");

        // Lire JSON
        int bet = 0;
        String choice = null;
        Integer number = null;
        try (BufferedReader r = req.getReader()) {
            JsonObject body = gson.fromJson(r, JsonObject.class);
            bet    = body.get("bet").getAsInt();
            choice = body.get("choice").getAsString();
            if (body.has("number") && !body.get("number").isJsonNull())
                number = body.get("number").getAsInt();
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_json\"}");
            return;
        }

        // Valider payload
        if (bet <= 0 || choice == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_payload\"}");
            return;
        }
        choice = choice.toLowerCase();
        boolean needsNumber = "number".equals(choice);
        if (needsNumber && (number == null || number < 0 || number > 36)) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_number\"}");
            return;
        }
        if (!needsNumber && !(choice.equals("red") || choice.equals("black") || choice.equals("green") || choice.equals("odd") || choice.equals("even"))) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_choice\"}");
            return;
        }

        try {
            // Charger l'utilisateur (credits)
            UserDao.UserRow u = UserDao.getByUsername(username);
            if (u == null) {
                resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
                return;
            }
            if (u.credits < bet) {
                resp.setStatus(HttpServletResponse.SC_CONFLICT);
                resp.getWriter().write("{\"ok\":false,\"error\":\"insufficient_credits\"}");
                return;
            }

            // RNG 0..36
            int n = ThreadLocalRandom.current().nextInt(0, 37);
            String color = (n == 0) ? "green" : (isRed(n) ? "red" : "black");
            String oddEven = (n == 0) ? "none" : (n % 2 == 0 ? "even" : "odd");

            // Payouts (simples)
            int payout = 0;
            boolean win = false;
            switch (choice) {
                case "red":   win = color.equals("red");   payout = win ? bet * 2 : 0; break; // 1:1
                case "black": win = color.equals("black"); payout = win ? bet * 2 : 0; break; // 1:1
                case "green": win = color.equals("green"); payout = win ? bet * 35 : 0; break; // 35:1 (00 non gérée)
                case "odd":   win = oddEven.equals("odd"); payout = win ? bet * 2 : 0; break; // 1:1
                case "even":  win = oddEven.equals("even");payout = win ? bet * 2 : 0; break; // 1:1
                case "number":
                    win = (n == number);
                    payout = win ? bet * 35 : 0; // 35:1
                    break;
            }

            // Calcul nouveaux crédits (débit bet + crédit payout)
            int newCredits = u.credits - bet + payout;
            UserDao.updateCredits(u.id, newCredits);

            // MAJ session
            s.setAttribute("credits", newCredits);

            // Log game
            JsonObject result = new JsonObject();
            result.addProperty("choice", choice);
            if (number != null) result.addProperty("chosenNumber", number);
            JsonObject outcome = new JsonObject();
            outcome.addProperty("number", n);
            outcome.addProperty("color", color);
            outcome.addProperty("oddEven", oddEven);
            result.add("outcome", outcome);
            result.addProperty("win", win);
            result.addProperty("payout", payout);

            UserDao.insertGameLog(u.id, "ROULETTE", bet, result.toString());

            // Réponse
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("outcome", outcome);
            out.addProperty("win", win);
            out.addProperty("payout", payout);
            out.addProperty("credits", newCredits);
            resp.getWriter().write(out.toString());

        } catch (SQLException e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"ok\":false,\"error\":\"server_error\"}");
        }
    }

    // Rouge (layout européen standard, simple mapping)
    private static boolean isRed(int n) {
        final int[] reds = {1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36};
        for (int v : reds) if (v == n) return true;
        return false;
    }
}
