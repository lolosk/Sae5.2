package com.sae502.servlets;

import com.sae502.servlets.DatabaseConnection;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

@WebServlet(name = "LoginServlet", value = "/login")
public class LoginServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String username = req.getParameter("username");
        String password = req.getParameter("password"); // en clair pour l’instant

        resp.setContentType("text/html");
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT id, username FROM users WHERE username = ? AND password_hash = ?")) {

            ps.setString(1, username);
            ps.setString(2, password);
            ResultSet rs = ps.executeQuery();

            PrintWriter out = resp.getWriter();
            if (rs.next()) {
                HttpSession session = req.getSession();
                session.setAttribute("username", username);

                // Rediriger vers le menu
                resp.sendRedirect("menu");
            } else {
                out.println("<h1>Échec de connexion (utilisateur/mot de passe)</h1>");
            }
        } catch (Exception e) {
            resp.getWriter().println("<h1>Erreur login : " + e.getMessage() + "</h1>");
        }
    }
}
