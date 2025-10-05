package com.sae502.servlets;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;

@WebServlet(urlPatterns = "/api/login")
public class LoginServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        // --- Lire le JSON du body
        String body = req.getReader().lines().reduce("", (a,b)->a+b);
        String username = "", password = "";
        try {
            com.google.gson.JsonObject json = new com.google.gson.Gson().fromJson(body, com.google.gson.JsonObject.class);
            if (json != null) {
                username = json.has("username") ? json.get("username").getAsString() : "";
                password = json.has("password") ? json.get("password").getAsString() : "";
            }
        } catch (Exception ex) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_json\"}");
            return;
        }

        if (username.isBlank() || password.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"missing_fields\"}");
            return;
        }

        try {
            // ✅ Auth en UNE passe (BCrypt)
            UserDao.UserRow u = UserDao.authenticateBCrypt(username, password);
            if (u == null) {
                resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_credentials\"}");
                return;
            }

            // Session (évite le nom 'session' si déjà utilisé)
            HttpSession httpSession = req.getSession(true);
            httpSession.setAttribute("userId",  u.id);
            httpSession.setAttribute("user",    u.username);
            httpSession.setAttribute("credits", u.credits);

            resp.getWriter().write(
                    "{\"ok\":true,\"user\":{\"id\":" + u.id +
                            ",\"username\":\"" + u.username + "\"," +
                            "\"credits\":" + u.credits + "}}"
            );

        } catch (java.sql.SQLException e) {
            e.printStackTrace(); // log côté Tomcat
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"ok\":false,\"error\":\"server_error\",\"detail\":\"sql_exception\"}");
        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"ok\":false,\"error\":\"server_error\"}");
        }
    }


}
