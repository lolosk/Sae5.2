package com.casino.servlets;

import com.casino.dao.UserDAO;
import com.casino.models.User;
import com.casino.utils.DatabaseManager;
import com.google.gson.Gson;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

/**
 * Servlet pour l'authentification des utilisateurs
 */
@WebServlet("/auth")
public class AuthServlet extends HttpServlet {
    private UserDAO userDAO;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        super.init();
        // Initialiser la base de données
        DatabaseManager.getInstance().initialize(getServletContext());
        this.userDAO = new UserDAO();
        this.gson = new Gson();
    }

    /**
     * GET - Vérifier le statut de connexion
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        
        HttpSession session = request.getSession(false);
        Map<String, Object> result = new HashMap<>();
        
        if (session != null && session.getAttribute("user") != null) {
            User user = (User) session.getAttribute("user");
            result.put("authenticated", true);
            result.put("username", user.getUsername());
            result.put("credits", user.getCredits());
        } else {
            result.put("authenticated", false);
        }
        
        response.getWriter().write(gson.toJson(result));
    }

    /**
     * POST - Connexion ou inscription
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        
        String action = request.getParameter("action");
        Map<String, Object> result = new HashMap<>();
        
        try {
            if ("login".equals(action)) {
                handleLogin(request, response, result);
            } else if ("register".equals(action)) {
                handleRegister(request, response, result);
            } else if ("logout".equals(action)) {
                handleLogout(request, response, result);
            } else {
                result.put("success", false);
                result.put("message", "Action non reconnue");
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Erreur serveur: " + e.getMessage());
        }
        
        response.getWriter().write(gson.toJson(result));
    }

    private void handleLogin(HttpServletRequest request, HttpServletResponse response, 
                           Map<String, Object> result) {
        String username = request.getParameter("username");
        String password = request.getParameter("password");
        
        if (username == null || password == null || username.trim().isEmpty() || password.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "Nom d'utilisateur et mot de passe requis");
            return;
        }
        
        User user = userDAO.findByUsername(username.trim());
        
        if (user != null && verifyPassword(password, user.getPasswordHash())) {
            // Mettre à jour la dernière connexion
            userDAO.updateLastLogin(user.getUserId());
            
            // Créer la session
            HttpSession session = request.getSession(true);
            session.setAttribute("user", user);
            session.setMaxInactiveInterval(30 * 60); // 30 minutes
            
            result.put("success", true);
            result.put("message", "Connexion réussie");
            result.put("username", user.getUsername());
            result.put("credits", user.getCredits());
        } else {
            result.put("success", false);
            result.put("message", "Nom d'utilisateur ou mot de passe incorrect");
        }
    }

    private void handleRegister(HttpServletRequest request, HttpServletResponse response, 
                              Map<String, Object> result) {
        String username = request.getParameter("username");
        String email = request.getParameter("email");
        String password = request.getParameter("password");
        
        // Validation des données
        if (username == null || email == null || password == null ||
            username.trim().isEmpty() || email.trim().isEmpty() || password.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "Tous les champs sont requis");
            return;
        }
        
        username = username.trim();
        email = email.trim();
        
        // Vérifier la longueur du mot de passe
        if (password.length() < 6) {
            result.put("success", false);
            result.put("message", "Le mot de passe doit contenir au moins 6 caractères");
            return;
        }
        
        // Vérifier si l'utilisateur existe déjà
        if (userDAO.usernameExists(username)) {
            result.put("success", false);
            result.put("message", "Ce nom d'utilisateur est déjà pris");
            return;
        }
        
        if (userDAO.emailExists(email)) {
            result.put("success", false);
            result.put("message", "Cette adresse email est déjà utilisée");
            return;
        }
        
        // Créer le nouvel utilisateur
        String passwordHash = hashPassword(password);
        User newUser = new User(username, email, passwordHash);
        newUser.setCredits(100.0); // Crédits de départ
        
        if (userDAO.createUser(newUser)) {
            // Créer la session
            HttpSession session = request.getSession(true);
            session.setAttribute("user", newUser);
            session.setMaxInactiveInterval(30 * 60); // 30 minutes
            
            result.put("success", true);
            result.put("message", "Inscription réussie");
            result.put("username", newUser.getUsername());
            result.put("credits", newUser.getCredits());
        } else {
            result.put("success", false);
            result.put("message", "Erreur lors de la création du compte");
        }
    }

    private void handleLogout(HttpServletRequest request, HttpServletResponse response, 
                            Map<String, Object> result) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        
        result.put("success", true);
        result.put("message", "Déconnexion réussie");
    }

    /**
     * Hache un mot de passe avec SHA-256
     */
    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (NoSuchAlgorithmException | IOException e) {
            throw new RuntimeException("Erreur lors du hachage du mot de passe", e);
        }
    }

    /**
     * Vérifie un mot de passe contre son hash
     */
    private boolean verifyPassword(String password, String hash) {
        return hashPassword(password).equals(hash);
    }
}