package com.sae502.servlets;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.SQLException;

@WebServlet(urlPatterns = "/api/register")
public class RegisterServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        // lire JSON
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = req.getReader()) {
            String line; while ((line = r.readLine()) != null) sb.append(line);
        }
        String username = "", password = "";
        try {
            JsonObject body = gson.fromJson(sb.toString(), JsonObject.class);
            if (body != null) {
                username = body.has("username") ? body.get("username").getAsString() : "";
                password = body.has("password") ? body.get("password").getAsString() : "";
            }
        } catch (Exception e) {
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
            boolean created = UserDao.createUserBCrypt(username, password);
            if (!created) {
                resp.setStatus(HttpServletResponse.SC_CONFLICT); // username pris
                resp.getWriter().write("{\"ok\":false,\"error\":\"username_taken\"}");
                return;
            }
            resp.setStatus(HttpServletResponse.SC_CREATED);
            resp.getWriter().write("{\"ok\":true}");
        } catch (SQLException e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"ok\":false,\"error\":\"server_error\"}");
        }
    }
}
