package com.sae502.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;

@WebServlet(urlPatterns = "/api/me")
public class MeServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");
        HttpSession s = req.getSession(false);
        if (s == null || s.getAttribute("user") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
            return;
        }
        String username = (String) s.getAttribute("user");

        int credits = 0;
        try {
            UserDao.UserRow u = UserDao.getByUsername(username);
            credits = (u != null ? u.credits : 0);
            s.setAttribute("credits", credits); // <-- MAJ de la session à chaque /me
        } catch (java.sql.SQLException e) {
            credits = 0;
        }

        resp.getWriter().write("{\"ok\":true,\"user\":{\"username\":\""+username+"\",\"credits\":"+credits+"}}");
    }

}