package com.sae502.servlets;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;

@WebServlet(urlPatterns = "/api/me")   // ⬅️ mapping ici
public class MeServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        HttpSession session = req.getSession(false);
        Object user = (session != null) ? session.getAttribute("user") : null;

        if (user == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // 401
            resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
            return;
        }

        String username = user.toString();
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.getWriter().write("{\"ok\":true,\"user\":{\"username\":\"" + username + "\"}}");
    }
}
