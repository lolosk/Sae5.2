package com.sae502.servlets;

import com.google.gson.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;

@WebServlet("/api/slot/spin")
public class SlotServlet extends HttpServlet {

    private static final List<String> SYMBOLS = Arrays.asList(
            "5G","documentation","firewall","optical-fiber","rj45",
            "routeur","server","wifi-signal","antena"
    );

    private static final Map<String,Integer> PAY = new HashMap<>();
    static {
        PAY.put("5G", 50);
        PAY.put("routeur", 10);
        PAY.put("firewall", 5);
        // autres = 2
        for (String s : SYMBOLS) PAY.putIfAbsent(s, 2);
    }

    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(401);
            resp.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        int userId = (int) session.getAttribute("userId");
        int credits = (int) session.getAttribute("credits");

        JsonObject body;
        try (BufferedReader br = req.getReader()) {
            body = JsonParser.parseReader(br).getAsJsonObject();
        } catch (Exception e) {
            resp.setStatus(400);
            resp.getWriter().write("{\"error\":\"invalid_payload\"}");
            return;
        }

        int bet = body.has("bet") ? Math.max(1, body.get("bet").getAsInt()) : 1;
        if (credits < bet) {
            resp.setStatus(409);
            resp.getWriter().write("{\"error\":\"insufficient_credits\"}");
            return;
        }
        credits -= bet;

        // Tirage grid[col][row] (0=top,1=mid,2=bot)
        Random rnd = new Random();
        String[][] grid = new String[3][3];
        for (int c = 0; c < 3; c++) {
            for (int r = 0; r < 3; r++) {
                grid[c][r] = SYMBOLS.get(rnd.nextInt(SYMBOLS.size()));
            }
        }

        // Paiement: ligne du milieu
        String a = grid[0][1], b = grid[1][1], c = grid[2][1];
        int payout = 0;
        List<String> wins = new ArrayList<>();
        if (a.equals(b) && b.equals(c)) {
            int mult = PAY.getOrDefault(a, 0);
            payout = mult * bet;
            if (payout > 0) wins.add("MIDLINE_" + a);
        }

        credits += payout;

        try {
            UserDao.updateCredits(userId, credits);
            session.setAttribute("credits", credits);

            JsonObject result = new JsonObject();
            result.addProperty("bet", bet);
            result.add("grid", gson.toJsonTree(grid));
            result.add("wins", gson.toJsonTree(wins));
            result.addProperty("payout", payout);
            result.addProperty("ts", Instant.now().toString());

            UserDao.insertGameLog(userId, "SLOT", bet, gson.toJson(result));
        } catch (SQLException ex) {
            resp.setStatus(500);
            resp.getWriter().write("{\"error\":\"server_error\"}");
            return;
        }

        JsonObject out = new JsonObject();
        out.add("grid", gson.toJsonTree(grid));
        out.add("wins", gson.toJsonTree(wins));
        out.addProperty("payout", payout);
        out.addProperty("credits", credits);

        resp.setStatus(200);
        try (OutputStream os = resp.getOutputStream()) {
            os.write(out.toString().getBytes(StandardCharsets.UTF_8));
        }
    }
}
