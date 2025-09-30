package com.sae502.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Random;

@WebServlet(name = "SlotServlet", value = "/slots")
public class SlotServlet extends HttpServlet {
    private static final String[] SYMBOLS = {
            "7️⃣", // seven
            "🍌", // banana
            "🍉",  // melon
            "🍋", // lemon
            "🟥", // bar
            "🔔", // bell
            "🍊", // orange
            "🍑", // plum
            "🍒" // cherry
    };

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        PrintWriter out = resp.getWriter();

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("username") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.println("{\"error\":\"Non connecté\"}");
            return;
        }

        String username = (String) session.getAttribute("username");
        int bet = Integer.parseInt(req.getParameter("bet"));

        try (Connection conn = DatabaseConnection.getConnection()) {
            PreparedStatement ps = conn.prepareStatement("SELECT credits, id FROM users WHERE username = ?");
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                out.println("{\"error\":\"Utilisateur introuvable\"}");
                return;
            }
            int credits = rs.getInt("credits");
            int userId = rs.getInt("id");

            if (bet > credits) {
                out.println("{\"error\":\"Mise trop élevée\",\"credits\":" + credits + "}");
                return;
            }

            // 🎰 Tirage
            Random rand = new Random();
            String s1 = SYMBOLS[rand.nextInt(SYMBOLS.length)];
            String s2 = SYMBOLS[rand.nextInt(SYMBOLS.length)];
            String s3 = SYMBOLS[rand.nextInt(SYMBOLS.length)];

            // 💰 Calcul du gain
            int gain = 0;
            if (s1.equals(s2) && s2.equals(s3)) {
                gain = bet * 10; // jackpot triple
            } else if (s1.equals(s2) || s2.equals(s3) || s1.equals(s3)) {
                gain = bet * 3;  // double
            }

            int newCredits = credits - bet + gain;

            // 🔄 Mise à jour crédits
            PreparedStatement update = conn.prepareStatement("UPDATE users SET credits = ? WHERE id = ?");
            update.setInt(1, newCredits);
            update.setInt(2, userId);
            update.executeUpdate();

            // 📝 Historique
            PreparedStatement insert = conn.prepareStatement(
                    "INSERT INTO games(user_id, game_type, bet, result) VALUES (?, ?, ?, ?)"
            );
            insert.setInt(1, userId);
            insert.setString(2, "slots");
            insert.setInt(3, bet);
            insert.setString(4, s1 + " " + s2 + " " + s3 + " (+" + gain + ")");
            insert.executeUpdate();

            // 📤 Réponse JSON
            out.println("{");
            out.println("\"symbols\": [\"" + s1 + "\", \"" + s2 + "\", \"" + s3 + "\"],");
            out.println("\"gain\": " + gain + ",");
            out.println("\"newCredits\": " + newCredits);
            out.println("}");

        } catch (Exception e) {
            out.println("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
