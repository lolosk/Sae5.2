package com.sae502.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet(name = "RegisterServlet", value = "/register")
public class RegisterServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String username = request.getParameter("username");
        String password = request.getParameter("password");

        try (Connection conn = DatabaseConnection.getConnection()) {
            String sql = "INSERT INTO users (username, password_hash) VALUES (?, ?)";
            PreparedStatement stmt = conn.prepareStatement(sql);
            stmt.setString(1, username);
            stmt.setString(2, password); // ⚠️ mot de passe en clair pour l’instant
            stmt.executeUpdate();

            // ✅ Redirection vers la page de login
            response.sendRedirect("http://localhost:8080/casino-backend/login.html");

        } catch (Exception e) {
            // Affiche un message d’erreur si pseudo déjà utilisé ou autre problème
            response.setContentType("text/html");
            response.getWriter().println("<h1>Erreur inscription : " + e.getMessage() + "</h1>");
        }
    }
}