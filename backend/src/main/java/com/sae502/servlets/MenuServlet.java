package com.sae502.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

@WebServlet(name = "MenuServlet", value = "/menu")
public class MenuServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/html");
        PrintWriter out = resp.getWriter();

        HttpSession session = req.getSession(false); // false = ne crée pas de session si inexistante
        if (session == null || session.getAttribute("username") == null) {
            // pas de session → redirection vers login
            resp.sendRedirect("login.html");
            return;
        }

        String username = (String) session.getAttribute("username");
        int credits = 0;

        // Récupérer le solde en DB
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT credits FROM users WHERE username = ?")) {
            ps.setString(1, username);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                credits = rs.getInt("credits");
            }
        } catch (Exception e) {
            out.println("<h1>Erreur DB : " + e.getMessage() + "</h1>");
            return;
        }

        // Générer le HTML dynamique
        out.println("<!DOCTYPE html>");
        out.println("<html lang='fr'>");
        out.println("<head>");
        out.println("<meta charset='UTF-8'>");
        out.println("<title>Casino en ligne - Menu</title>");
        out.println("<style>");
        out.println("body { font-family: Arial, sans-serif; background: radial-gradient(circle at center, #222, #000); color: #fff; margin:0; text-align:center; }");
        out.println("header { display:flex; justify-content:space-between; align-items:center; padding:15px 30px; background:rgba(0,0,0,0.6); border-bottom:2px solid #ff9800; }");
        out.println(".profile p { margin:0; font-size:14px; }");
        out.println(".menu { display:flex; justify-content:center; flex-wrap:wrap; gap:20px; margin-top:40px; }");
        out.println(".game-card { background:rgba(255,255,255,0.1); border:2px solid #ff9800; border-radius:12px; padding:30px; width:200px; cursor:pointer; transition:0.2s; }");
        out.println(".game-card:hover { transform:scale(1.05); background:rgba(255,152,0,0.2); }");
        out.println(".game-card h2 { margin:0 0 10px; color:#ff9800; }");
        out.println("</style>");
        out.println("</head>");
        out.println("<body>");

        out.println("<header>");
        out.println("<div class='logo'><h2>🎰 Casino Online</h2></div>");
        out.println("<div class='profile'>");
        out.println("<p>Utilisateur : " + username + "</p>");
        out.println("<p>Crédits : " + credits + " 💰</p>");
        out.println("</div>");
        out.println("</header>");

        out.println("<h1>Menu Principal</h1>");
        out.println("<div class='menu'>");
        out.println("<div class='game-card' onclick=\"location.href='slots'\">");
        out.println("<h2>🎰 Machine à sous</h2><p>Tente ta chance avec 3 symboles !</p></div>");
        out.println("<div class='game-card' onclick=\"location.href='roulette'\">");
        out.println("<h2>🎡 Roulette</h2><p>Parie sur le bon numéro.</p></div>");
        out.println("<div class='game-card' onclick=\"location.href='horses'\">");
        out.println("<h2>🏇 Courses</h2><p>Choisis ton cheval et regarde la course !</p></div>");
        out.println("</div>");

        out.println("</body>");
        out.println("</html>");
    }
}
