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
    private static final String[] SYMBOLS = {"🍒", "🍋", "⭐️", "🔔", "🍀"};

    // ✅ Afficher le formulaire de jeu
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/html");
        PrintWriter out = resp.getWriter();

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("username") == null) {
            resp.sendRedirect("login.html");
            return;
        }

        out.println("<!DOCTYPE html>");
        out.println("<html lang='fr'>");
        out.println("<head>");
        out.println("<meta charset='UTF-8'>");
        out.println("<title>🎰 Machine à sous</title>");
        out.println("<style>");
        out.println("body { font-family: Arial, sans-serif; background: radial-gradient(circle at center, #111, #000); color: #fff; text-align: center; }");
        out.println("h2 { color: #ff9800; }");
        out.println("form { margin-top: 30px; }");
        out.println("input, button { font-size: 18px; padding: 10px 20px; margin: 10px; border-radius: 8px; border: 2px solid #ff9800; background: #222; color: #fff; }");
        out.println("button { background: #ff9800; color: #000; cursor: pointer; }");
        out.println("button:hover { background: #ffa733; }");
        out.println("</style>");
        out.println("</head>");
        out.println("<body>");
        out.println("<h2>🎰 Machine à sous</h2>");
        out.println("<form method='POST' action='slots'>");
        out.println("<label>Mise :</label>");
        out.println("<input type='number' name='bet' min='1' required>");
        out.println("<button type='submit'>Jouer</button>");
        out.println("</form>");
        out.println("<p><a href='menu'>⬅ Retour au menu</a></p>");
        out.println("</body>");
        out.println("</html>");

    }

    // ✅ Jouer et afficher le résultat
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/html");
        PrintWriter out = resp.getWriter();

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("username") == null) {
            resp.sendRedirect("login.html");
            return;
        }

        String username = (String) session.getAttribute("username");
        int bet = Integer.parseInt(req.getParameter("bet"));

        try (Connection conn = DatabaseConnection.getConnection()) {
            // 1️⃣ Récupérer crédits actuels
            PreparedStatement ps = conn.prepareStatement("SELECT credits, id FROM users WHERE username = ?");
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                out.println("<h1>Utilisateur introuvable</h1>");
                return;
            }
            int credits = rs.getInt("credits");
            int userId = rs.getInt("id");

            if (bet > credits) {
                out.println("<h1>Mise trop élevée ! Crédits restants : " + credits + "</h1>");
                out.println("<p><a href='slots'>Rejouer</a> | <a href='menu'>Menu</a></p>");
                return;
            }

            // 2️⃣ Tirage des symboles
            Random rand = new Random();
            String s1 = SYMBOLS[rand.nextInt(SYMBOLS.length)];
            String s2 = SYMBOLS[rand.nextInt(SYMBOLS.length)];
            String s3 = SYMBOLS[rand.nextInt(SYMBOLS.length)];

            // 3️⃣ Calcul du gain
            int gain = 0;
            if (s1.equals(s2) && s2.equals(s3)) {
                gain = bet * 5; // triple → jackpot
            } else if (s1.equals(s2) || s2.equals(s3) || s1.equals(s3)) {
                gain = bet * 2; // double → petit gain
            }

            int newCredits = credits - bet + gain;

            // 4️⃣ Mise à jour crédits
            PreparedStatement update = conn.prepareStatement("UPDATE users SET credits = ? WHERE id = ?");
            update.setInt(1, newCredits);
            update.setInt(2, userId);
            update.executeUpdate();

            // 5️⃣ Enregistrer la partie
            PreparedStatement insert = conn.prepareStatement("INSERT INTO games(user_id, game_type, bet, result) VALUES (?, ?, ?, ?)");
            insert.setInt(1, userId);
            insert.setString(2, "slots");
            insert.setInt(3, bet);
            insert.setString(4, s1 + " " + s2 + " " + s3 + " (+" + gain + ")");
            insert.executeUpdate();

            // 6️⃣ Affichage résultat
            out.println("<!DOCTYPE html>");
            out.println("<html lang='fr'>");
            out.println("<head>");
            out.println("<meta charset='UTF-8'>");
            out.println("<title>🎰 Machine à sous</title>");
            out.println("<style>");
            out.println("body { font-family: Arial, sans-serif; background: radial-gradient(circle at center, #111, #000); color: #fff; text-align: center; }");
            out.println("h1 { color: #ff9800; text-shadow: 0 0 10px #ff9800; }");
            out.println(".slot-container { display: flex; justify-content: center; gap: 20px; margin: 30px auto; }");
            out.println(".slot { font-size: 60px; width: 80px; height: 80px; display: flex; justify-content: center; align-items: center; background: #111; border: 3px solid #ff9800; border-radius: 10px; box-shadow: 0 0 10px #ff9800; }");
            out.println("</style>");
            out.println("</head>");
            out.println("<body>");

            out.println("<h1>🎰 Résultat</h1>");
            out.println("<div class='slot-container'>");
            out.println("<div class='slot' id='slot1'>❓</div>");
            out.println("<div class='slot' id='slot2'>❓</div>");
            out.println("<div class='slot' id='slot3'>❓</div>");
            out.println("</div>");

            out.println("<div id='result' style='display:none;'>");
            out.println("<p>Mise : " + bet + " | Gain : " + gain + "</p>");
            out.println("<p>Crédits restants : " + newCredits + " 💰</p>");
            out.println("</div>");

            out.println("<p><a href='slots'>Rejouer</a> | <a href='menu'>Menu</a></p>");

            /* --- SCRIPT JS --- */
            out.println("<script>");
            out.println("const symbols = ['🍒','🍋','⭐️','🔔','🍀'];");

            out.println("setTimeout(() => {");
            out.println("  document.getElementById('result').style.display = 'block';");
            out.println("}, 3600);"); // un peu après l’arrêt du 3e rouleau


            // résultat réel envoyé par le backend
            out.println("const result = ['" + s1 + "', '" + s2 + "', '" + s3 + "'];");

            // fonction pour changer un slot rapidement
            out.println("function spinSlot(id, stopSymbol, delay) {");
            out.println("  let slot = document.getElementById(id);");
            out.println("  let i = 0;");
            out.println("  let interval = setInterval(() => {");
            out.println("    slot.textContent = symbols[Math.floor(Math.random() * symbols.length)];");
            out.println("  }, 100);"); // change toutes les 100ms

            // arrêt au bon symbole après un délai
            out.println("  setTimeout(() => {");
            out.println("    clearInterval(interval);");
            out.println("    slot.textContent = stopSymbol;");
            out.println("  }, delay);");
            out.println("}");

            out.println("spinSlot('slot1', result[0], 1500);"); // arrêt après 1.5s
            out.println("spinSlot('slot2', result[1], 2500);"); // arrêt après 2.5s
            out.println("spinSlot('slot3', result[2], 3500);"); // arrêt après 3.5s
            out.println("</script>");

            out.println("</body>");
            out.println("</html>");



        } catch (Exception e) {
            out.println("<h1>Erreur : " + e.getMessage() + "</h1>");
        }
    }
}
