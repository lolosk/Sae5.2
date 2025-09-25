package com.sae502.servlets;

import java.io.*;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.*;

@WebServlet(name = "LoginServlet", value = "/login")
public class LoginServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String username = request.getParameter("username");
        String password = request.getParameter("password");

        response.setContentType("text/html");
        PrintWriter out = response.getWriter();

        // Pour l’instant → simple test (pas de DB encore)
        if ("test".equals(username) && "1234".equals(password)) {
            out.println("<h1>Connexion réussie ! Bienvenue, " + username + "</h1>");
        } else {
            out.println("<h1>Échec de connexion. Pseudo ou mot de passe incorrect.</h1>");
        }
    }
}
